import { randomUUID, generateKeyPairSync, createHash, createPrivateKey, sign as cryptoSign } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import WebSocket from 'ws';
import type { Adapter } from './adapter.js';
import type { Task, ExecutionEvent, HealthStatus, CoordinationData } from '@bridgetalk/shared';
import { logger } from '../lib/logger.js';

// ─── WebSocket Protocol Types (OpenClaw Protocol v3) ───

interface WsRequest {
  type: 'req';
  id: string;
  method: string;
  params: unknown;
}

interface WsResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: unknown;
}

interface WsEvent {
  type: 'event';
  event: string;
  payload: unknown;
  seq?: number;
}

type WsMessage = WsResponse | WsEvent | { type: string; [key: string]: unknown };

// chat event payload from Gateway
interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}

// ─── Device Identity Types ───

interface DeviceKeyPair {
  publicKey: string;  // base64
  privateKey: string; // base64
}

interface DeviceToken {
  token: string;
  expiresAt?: number;
}

export class OpenClawAdapter implements Adapter {
  id = 'openclaw';
  name = 'OpenClaw Gateway';
  version = '1.0.0';

  private gatewayUrl: string;
  private gatewayToken: string;
  private timeoutMs: number;
  private cancelledTasks = new Set<string>();

  // Device identity state
  private deviceId: string | null = null;
  private devicePublicKey: string | null = null;
  private devicePrivateKey: string | null = null; // for signing
  private deviceToken: string | null = null;
  private readonly deviceConfigDir = join(homedir(), '.openclaw-inbox');
  private usingDeviceTokenForConnection = false;

  // WebSocket connection state
  private ws: WebSocket | null = null;
  private authenticated = false;
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelay = 1000;

  // Request/response correlation
  private reqIdCounter = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: WsResponse) => void;
    reject: (reason: Error) => void;
  }>();

  // Chat event listeners keyed by sessionKey
  private chatEventListeners = new Map<string, (payload: ChatEventPayload) => void>();

  // 🆕 Global chat event listener (receives all chat events, regardless of sessionKey)
  private globalChatListener: ((payload: ChatEventPayload) => void) | null = null;

  // Map taskId → sessionKey for cancel
  private taskSessionMap = new Map<string, string>();

  // 🆕 Known sessionKey set (used to detect new sub-agent activity)
  private knownSessionKeys = new Set<string>();
  private readonly requiredScopes = [
    'operator.read',
    'operator.write',
    'operator.pairing',      // device pairing
    'operator.approvals',    // execution approvals
    'operator.admin'
  ] as const;

  constructor() {
    const rawUrl = (process.env.OPENCLAW_GATEWAY_URL || '').replace(/\/+$/, '');
    this.gatewayUrl = this.normalizeWsUrl(rawUrl);
    this.gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || '';
    this.timeoutMs = Number(process.env.OPENCLAW_GATEWAY_TIMEOUT) || 300_000;
  }

  // ─── Device Identity Management ───

  /**
   * Ensure device identity is loaded or generated
   * 1. Try to load saved keypair
   * 2. If not exists, generate new Ed25519 keypair and save
   * 3. Calculate device ID (SHA256 of publicKey)
   * 4. Try to load device token (if exists)
   */
  private async ensureDeviceIdentity(): Promise<void> {
    if (this.deviceId && this.devicePublicKey) return;

    // Ensure config directory exists
    try {
      await fs.mkdir(this.deviceConfigDir, { recursive: true, mode: 0o700 });
    } catch (err) {
      console.error('Failed to create device config directory:', err);
    }

    const keypairPath = join(this.deviceConfigDir, 'device-keypair.json');
    let keypair: DeviceKeyPair;

    try {
      // Try to load existing keypair
      const data = await fs.readFile(keypairPath, 'utf-8');
      keypair = JSON.parse(data);
      console.log('[Device Identity] Loaded existing keypair');
    } catch {
      // keypair does not exist, generate new one
      console.log('[Device Identity] Generating new Ed25519 keypair');
      const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      });

      keypair = {
        publicKey: publicKey.toString('base64'),
        privateKey: privateKey.toString('base64'),
      };

      // Save keypair to file (permissions 0600)
      await fs.writeFile(keypairPath, JSON.stringify(keypair, null, 2), { mode: 0o600 });
      console.log('[Device Identity] Keypair saved to:', keypairPath);
    }

    // Extract raw 32-byte Ed25519 public key from SPKI DER format
    // SPKI DER format: [12 bytes ASN.1 header][32 bytes raw public key]
    const publicKeyDER = Buffer.from(keypair.publicKey, 'base64');
    const rawPublicKey = publicKeyDER.slice(-32); // take last 32 bytes
    const rawPublicKeyBase64 = rawPublicKey.toString('base64');

    // Calculate device ID (SHA256 of raw publicKey, hex string)
    this.deviceId = createHash('sha256').update(rawPublicKey).digest('hex');
    this.devicePublicKey = rawPublicKeyBase64; // use raw public key
    this.devicePrivateKey = keypair.privateKey; // save DER private key for signing

    console.log('[Device Identity] Device ID:', this.deviceId);
    console.log('[Device Identity] Raw Public Key:', rawPublicKeyBase64);

    // Try to load device token
    const tokenPath = join(this.deviceConfigDir, 'device-token.json');
    try {
      const tokenData = await fs.readFile(tokenPath, 'utf-8');
      const { token, expiresAt } = JSON.parse(tokenData) as DeviceToken;

      // Check if token is expired
      if (!expiresAt || expiresAt > Date.now()) {
        this.deviceToken = token;
        console.log('[Device Identity] Loaded device token');
      } else {
        console.log('[Device Identity] Device token expired');
      }
    } catch {
      console.log('[Device Identity] Device token not found, will use gateway token');
    }
  }

  /**
   * Save device token returned from Gateway
   */
  private async saveDeviceToken(token: string, expiresAt?: number): Promise<void> {
    const tokenPath = join(this.deviceConfigDir, 'device-token.json');
    const tokenData: DeviceToken = { token, expiresAt };

    try {
      await fs.writeFile(tokenPath, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
      this.deviceToken = token;
      console.log('[Device Identity] Device token saved');
    } catch (err) {
      console.error('[Device Identity] Failed to save device token:', err);
    }
  }

  private hasMissingScopeError(errMsg: string): boolean {
    return /missing scope:/i.test(errMsg);
  }

  private hasDeviceTokenMismatchError(errMsg: string): boolean {
    return /device token mismatch/i.test(errMsg);
  }

  private buildDevicePayload(nonce?: string): {
    id: string | null;
    publicKey: string | null;
    signature: string;
    signedAt: number;
    nonce?: string;
  } {
    const signedAt = Date.now();
    const tokenForSign = this.deviceToken || this.gatewayToken || '';
    const role = 'operator';
    const scopes = [...this.requiredScopes];
    const version = nonce ? 'v2' : 'v1';
    const base = [
      version,
      this.deviceId || '',
      'gateway-client',
      'backend',
      role,
      scopes.join(','),
      String(signedAt),
      tokenForSign,
    ];
    if (version === 'v2') base.push(nonce || '');
    const message = base.join('|');
    let signature = '';

    if (this.devicePrivateKey) {
      try {
        const privateKey = createPrivateKey({
          key: Buffer.from(this.devicePrivateKey, 'base64'),
          format: 'der',
          type: 'pkcs8',
        });
        const sig = cryptoSign(
          null,
          Buffer.from(message, 'utf8'),
          privateKey,
        );
        signature = sig
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/g, '');
      } catch (err) {
        console.warn('[Device Identity] Signing failed, will send empty signature:', err);
      }
    }

    return {
      id: this.deviceId,
      publicKey: this.devicePublicKey
        ? this.devicePublicKey
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/g, '')
        : null,
      signature,
      signedAt,
      ...(nonce ? { nonce } : {}),
    };
  }

  private async invalidateDeviceToken(reason: string): Promise<void> {
    const tokenPath = join(this.deviceConfigDir, 'device-token.json');
    this.deviceToken = null;
    this.usingDeviceTokenForConnection = false;

    try {
      await fs.rm(tokenPath, { force: true });
      console.log(`[Device Identity] Cleaned up device token (${reason})`);
    } catch (err) {
      console.warn('[Device Identity] Failed to clean up device token:', err);
    }
  }

  /**
   * Initiate device pairing request (using node.pair.request RPC)
   */
  private async requestDevicePairing(): Promise<string> {
    console.log('[Device Pairing] Initiating pairing request...');

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }

      const pairReq: WsRequest = {
        type: 'req',
        id: this.nextReqId(),
        method: 'node.pair.request',
        params: {
          deviceId: this.deviceId,
          publicKey: this.devicePublicKey,
          clientId: 'agent-inbox-channel',
          clientMode: 'backend',
          platform: process.platform,
          displayName: 'Agent Inbox Channel',
        },
      };

      this.pendingRequests.set(pairReq.id, {
        resolve: async (res) => {
          if (res.ok) {
            const requestId = (res.payload as { requestId?: string })?.requestId || 'unknown';
            console.log('[Device Pairing] ✓ Pairing request created');
            console.log('[Device Pairing] Request ID:', requestId);
            console.log('[Device Pairing] Please run the following command to approve pairing:');
            console.log(`[Device Pairing]   openclaw nodes approve ${requestId}`);
            resolve(requestId);
          } else {
            const errMsg = typeof res.error === 'string'
              ? res.error
              : (res.error as { message?: string })?.message || JSON.stringify(res.error);
            reject(new Error(`Pairing request failed: ${errMsg}`));
          }
        },
        reject: (err) => reject(err),
      });

      this.ws.send(JSON.stringify(pairReq));
      console.log('[Device Pairing] Sent node.pair.request');
    });
  }

  // ─── URL Normalization ───

  private normalizeWsUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://')) return url.replace('http://', 'ws://');
    if (url.startsWith('https://')) return url.replace('https://', 'wss://');
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) return `ws://${url}`;
    return url;
  }

  // ─── WebSocket Connection Management ───

  private nextReqId(): string {
    return `req_${++this.reqIdCounter}_${Date.now()}`;
  }

  private async ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) return;
    if (this.connecting) {
      await this.waitForConnection();
      return;
    }
    // Ensure device identity is ready before connecting
    await this.ensureDeviceIdentity();
    try {
      await this.connect();
    } catch (err) {
      const errMsg = (err as Error).message;
      if (this.deviceToken && (this.hasMissingScopeError(errMsg) || this.hasDeviceTokenMismatchError(errMsg))) {
        const reason = this.hasDeviceTokenMismatchError(errMsg) ? 'token mismatch' : 'insufficient scope';
        console.log(`[Connect] device token ${reason}, falling back to gateway token retry...`);
        await this.invalidateDeviceToken(reason);
        await this.connect();
        return;
      }
      throw err;
    }
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
        if (!this.connecting && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
          clearInterval(check);
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        }
      }, 100);
      const timeout = setTimeout(() => {
        clearInterval(check);
        reject(new Error('Waiting for WebSocket connection timeout'));
      }, 15_000);
    });
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connecting = true;
      this.authenticated = false;

      const ws = new WebSocket(this.gatewayUrl);
      let handshakeTimeout: ReturnType<typeof setTimeout>;
      let settled = false;

      const settle = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(handshakeTimeout);
        if (err) {
          this.connecting = false;
          reject(err);
        } else {
          this.connecting = false;
          this.reconnectAttempts = 0;
          resolve();
        }
      };

      handshakeTimeout = setTimeout(() => {
        ws.close();
        settle(new Error('WebSocket handshake timeout (15s)'));
      }, 15_000);

      ws.on('open', () => {
        this.ws = ws;
      });

      ws.on('message', (raw: WebSocket.RawData) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }

        // Authentication handshake: received connect.challenge → send pairing request or connect request
        if (msg.type === 'event' && (msg as WsEvent).event === 'connect.challenge') {
          const evt = msg as WsEvent;
          const challengePayload = evt.payload as { nonce?: string };

          // Prefer device token, otherwise use gateway token (both passed via token field)
          const useDeviceToken = Boolean(this.deviceToken);
          this.usingDeviceTokenForConnection = useDeviceToken;
          const authParam = { token: useDeviceToken ? this.deviceToken : this.gatewayToken };
          console.log('[Connect] Using', useDeviceToken ? 'device token' : 'gateway token', 'for authentication');

          const connectReq: WsRequest = {
            type: 'req',
            id: this.nextReqId(),
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: 'gateway-client',
                version: '1.0.0',
                platform: process.platform,
                mode: 'backend',
              },
              role: 'operator',
              // Explicitly declare all required scopes (2026.2.14+ operator.admin no longer implicitly includes other scopes)
              scopes: [
                ...this.requiredScopes
              ],
              caps: [],
              commands: [],
              permissions: {},
              device: this.buildDevicePayload(challengePayload?.nonce),
              auth: authParam,
              locale: 'zh-CN',
              userAgent: 'openclaw-agent-inbox/1.0.0',
            },
          };

          this.pendingRequests.set(connectReq.id, {
            resolve: async (res) => {
              if (res.ok) {
                this.authenticated = true;

                // Extract device token from hello-ok response (if exists)
                const payload = res.payload as { auth?: { deviceToken?: string; expiresAt?: number } };
                this.logScopeProbe(payload);
                if (payload?.auth?.deviceToken) {
                  await this.saveDeviceToken(
                    payload.auth.deviceToken,
                    payload.auth.expiresAt,
                  );
                }

                // Gateway 2026.2.14+ is stricter with pairing scope, does not auto-initiate pairing requests by default,
                // to avoid affecting core chat.send capability; if pairing is needed, manually execute CLI flow.

                settle();
              } else {
                console.log('[Connect Error] Full response:', JSON.stringify(res, null, 2));
                const errMsg = typeof res.error === 'string'
                  ? res.error
                  : (res.error as { message?: string })?.message || JSON.stringify(res.error);
                settle(new Error(`Authentication failed: ${errMsg}`));
              }
            },
            reject: (err) => settle(err),
          });

          console.log('[Connect Request] device:', JSON.stringify((connectReq.params as { device?: unknown }).device, null, 2));
          ws.send(JSON.stringify(connectReq));
          return;
        }

        // Response frame → associate to pending request
        if (msg.type === 'res') {
          const res = msg as WsResponse;
          const pending = this.pendingRequests.get(res.id);
          if (pending) {
            this.pendingRequests.delete(res.id);
            pending.resolve(res);
          }
          return;
        }

        // Event frame
        if (msg.type === 'event') {
          const evt = msg as WsEvent;

          // chat event → dispatch to listener for corresponding sessionKey
          if (evt.event === 'chat') {
            const payload = evt.payload as ChatEventPayload;
            if (payload?.sessionKey) {
              // 🆕 First call global listener (for detecting new sub-agent activity)
              if (this.globalChatListener) {
                this.globalChatListener(payload);
              }

              // Then call listener for specific sessionKey
              const listener = this.chatEventListeners.get(payload.sessionKey);
              if (listener) listener(payload);
            }
          }
        }
      });

      ws.on('error', (err) => {
        settle(new Error(`WebSocket error: ${err.message}`));
      });

      ws.on('close', (_code, _reason) => {
        this.authenticated = false;
        this.usingDeviceTokenForConnection = false;
        this.ws = null;
        settle(new Error('WebSocket connection closed'));

        for (const [id, pending] of this.pendingRequests) {
          pending.reject(new Error('WebSocket connection disconnected'));
          this.pendingRequests.delete(id);
        }

        this.scheduleReconnect();
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30_000,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // connect failure will trigger close → schedule reconnect again
      }
    }, delay);
  }

  private sendRequest(method: string, params: unknown, timeout?: number): Promise<WsResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const req: WsRequest = {
        type: 'req',
        id: this.nextReqId(),
        method,
        params,
      };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(req.id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout || this.timeoutMs);

      this.pendingRequests.set(req.id, {
        resolve: (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.ws.send(JSON.stringify(req));
    });
  }

  private extractGatewayError(error: unknown): string {
    if (typeof error === 'string') return error;
    return (error as { message?: string })?.message || JSON.stringify(error);
  }

  private readGrantedScopes(payload: unknown): string[] | null {
    const data = payload as {
      scopes?: unknown;
      grantedScopes?: unknown;
      session?: { scopes?: unknown };
      auth?: { scopes?: unknown; grantedScopes?: unknown };
    };

    const candidates = [
      data?.scopes,
      data?.grantedScopes,
      data?.session?.scopes,
      data?.auth?.scopes,
      data?.auth?.grantedScopes,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        const scopes = candidate.filter((s): s is string => typeof s === 'string');
        if (scopes.length > 0) return scopes;
      }
    }

    return null;
  }

  private logScopeProbe(payload: unknown): void {
    const requested = [...this.requiredScopes];
    const granted = this.readGrantedScopes(payload);

    if (!granted) {
      console.log('[Scope Probe] Gateway did not return parsable scopes field');
      console.log('[Scope Probe] Requested scopes:', requested.join(', '));
      return;
    }

    const missing = requested.filter((scope) => !granted.includes(scope));
    console.log('[Scope Probe] Requested scopes:', requested.join(', '));
    console.log('[Scope Probe] Granted scopes:', granted.join(', '));

    if (missing.length > 0) {
      console.warn('[Scope Probe] Missing scopes:', missing.join(', '));
    } else {
      console.log('[Scope Probe] All required scopes granted');
    }
  }

  // 🆕 Register global chat event listener
  setGlobalChatListener(listener: (payload: ChatEventPayload) => void): void {
    this.globalChatListener = listener;
  }

  // 🆕 Remove global listener
  removeGlobalChatListener(): void {
    this.globalChatListener = null;
  }

  // ─── Execute Task (first time creating task) ───

  async *execute(task: Task, content: string): AsyncGenerator<ExecutionEvent> {
    this.cancelledTasks.delete(task.id);
    yield* this.chatSend(task.id, content, task.agentId);
  }

  // ─── Send Message (append message to existing task) ───

  async *sendMessage(task: Task, content: string): AsyncGenerator<ExecutionEvent> {
    yield* this.chatSend(task.id, content, task.agentId);
  }

  // ─── Core: send message to Gateway and wait for complete reply ───

  private async *chatSend(taskId: string, content: string, agentId: string = 'main'): AsyncGenerator<ExecutionEvent> {
    if (!this.gatewayUrl) {
      yield {
        type: 'error',
        timestamp: Date.now(),
        data: { message: 'OpenClaw Gateway not configured, please set OPENCLAW_GATEWAY_URL environment variable' },
      };
      return;
    }

    try {
      await this.ensureConnected();
    } catch (err) {
      yield {
        type: 'error',
        timestamp: Date.now(),
        data: { message: `WebSocket connection failed: ${(err as Error).message}` },
      };
      return;
    }

    if (this.cancelledTasks.has(taskId)) return;

    // Event queue: bridge WS callback and AsyncGenerator
    const eventQueue: (ExecutionEvent | null)[] = [];
    let queueResolve: (() => void) | null = null;
    let fullOutput = '';
    let gotResult = false;

    const pushEvent = (evt: ExecutionEvent | null) => {
      eventQueue.push(evt);
      if (queueResolve) {
        queueResolve();
        queueResolve = null;
      }
    };

    const waitForEvent = (): Promise<void> => {
      if (eventQueue.length > 0) return Promise.resolve();
      return new Promise(resolve => { queueResolve = resolve; });
    };

    // Each Agent has independent session, dynamically build sessionKey via agentId
    const sessionKey = `agent:${agentId}:main`;
    this.taskSessionMap.set(taskId, sessionKey);

    // Register chat event listener
    this.chatEventListeners.set(sessionKey, (payload: ChatEventPayload) => {
      if (this.cancelledTasks.has(taskId)) return;

      switch (payload.state) {
        case 'delta': {
          // delta only accumulates text, don't yield
          const deltaContent = this.extractTextContent(payload.message);
          if (deltaContent) {
            fullOutput = deltaContent;
          }
          break;
        }

        case 'final': {
          gotResult = true;
          const finalContent = this.extractTextContent(payload.message);
          const output = finalContent || fullOutput || 'Task execution completed';

          // Detect coordination markers
          const coordination = this.detectCoordination(output, agentId);
          if (coordination) {
            pushEvent({
              type: 'coordination',
              timestamp: Date.now(),
              data: coordination,
            });
          }

          // Continue pushing regular result
          pushEvent({
            type: 'result',
            timestamp: Date.now(),
            data: { message: output },
          });
          pushEvent(null);
          break;
        }

        case 'error': {
          pushEvent({
            type: 'error',
            timestamp: Date.now(),
            data: { message: payload.errorMessage || 'Execution error' },
          });
          pushEvent(null);
          break;
        }

        case 'aborted': {
          pushEvent({
            type: 'error',
            timestamp: Date.now(),
            data: { message: 'Task has been aborted' },
          });
          pushEvent(null);
          break;
        }
      }
    });

    try {
      let res = await this.sendRequest('chat.send', {
        sessionKey,
        message: content,
        idempotencyKey: randomUUID(),
      });

      // Device token may have insufficient scope after Gateway upgrade; auto fall back to gateway token and retry once
      if (!res.ok && this.usingDeviceTokenForConnection) {
        const errMsg = this.extractGatewayError(res.error);
        if (this.hasMissingScopeError(errMsg) || this.hasDeviceTokenMismatchError(errMsg)) {
          const reason = this.hasDeviceTokenMismatchError(errMsg)
            ? 'chat.send token mismatch'
            : 'chat.send insufficient scope';
          console.log('[SendMessage] device token unavailable, falling back to gateway token retry...');
          await this.invalidateDeviceToken(reason);

          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
          }
          await this.ensureConnected();

          res = await this.sendRequest('chat.send', {
            sessionKey,
            message: content,
            idempotencyKey: randomUUID(),
          });
        }
      }

      if (!res.ok) {
        const errMsg = this.extractGatewayError(res.error);
        yield {
          type: 'error',
          timestamp: Date.now(),
          data: { message: `Gateway execution failed: ${errMsg}` },
        };
        return;
      }

      // Timeout protection - commented out (OpenClaw Gateway handles timeout itself, client doesn't need extra warnings)
      // const timeoutTimer = setTimeout(() => {
      //   pushEvent({
      //     type: 'error',
      //     timestamp: Date.now(),
      //     data: { message: `Gateway request timeout (${this.timeoutMs / 1000}s)` },
      //   });
      //   pushEvent(null);
      // }, this.timeoutMs);

      // Consume event queue
      while (true) {
        if (this.cancelledTasks.has(taskId)) {
          // clearTimeout(timeoutTimer);
          break;
        }

        await waitForEvent();

        while (eventQueue.length > 0) {
          const evt = eventQueue.shift()!;
          if (evt === null) {
            // clearTimeout(timeoutTimer);
            if (!gotResult && fullOutput) {
              yield {
                type: 'result',
                timestamp: Date.now(),
                data: { message: fullOutput },
              };
            }
            return;
          }
          yield evt;
        }
      }
    } catch (err) {
      yield {
        type: 'error',
        timestamp: Date.now(),
        data: { message: `Gateway communication failed: ${(err as Error).message}` },
      };
    } finally {
      this.chatEventListeners.delete(sessionKey);
      this.taskSessionMap.delete(taskId);
    }
  }

  // ─── Cancel ───

  cancel(taskId: string): void {
    this.cancelledTasks.add(taskId);
    const sessionKey = this.taskSessionMap.get(taskId);

    if (sessionKey && this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.sendRequest('chat.abort', { sessionKey }, 5_000).catch(() => {});
    }

    if (sessionKey) {
      this.chatEventListeners.delete(sessionKey);
    }
    this.taskSessionMap.delete(taskId);
  }

  // ─── Health Check ───

  health(): HealthStatus {
    if (!this.gatewayUrl) {
      return { status: 'unavailable', message: 'OPENCLAW_GATEWAY_URL 未配置' };
    }
    if (!this.gatewayToken) {
      return { status: 'degraded', message: 'OPENCLAW_GATEWAY_TOKEN not configured, may not be able to authenticate' };
    }
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      return { status: 'healthy', message: 'WebSocket connected and authenticated' };
    }
    if (this.connecting) {
      return { status: 'degraded', message: 'WebSocket connecting...' };
    }
    return { status: 'degraded', message: 'WebSocket not connected (will auto-connect on next request)' };
  }

  // ─── Private Helpers ───

  // Coordination detection: identify coordination markers from agent output
  private detectCoordination(text: string, currentAgentId: string): CoordinationData | null {
    const patterns = [
      { regex: /\[TEAM_CREATE\]\s*(.+)/, type: 'team_created' as const },
      { regex: /\[DELEGATE\]\s*(\w+):\s*(.+)/, type: 'task_delegated' as const },
      { regex: /\[AGENT_REPLY\]\s*(\w+):\s*(.+)/, type: 'agent_reply' as const },
      { regex: /\[RESULT_MERGED\]\s*(.+)/, type: 'result_merged' as const },
    ];

    for (const { regex, type } of patterns) {
      const match = text.match(regex);
      if (match) {
        if (type === 'task_delegated' || type === 'agent_reply') {
          return {
            type,
            from: currentAgentId,
            to: match[1],
            summary: match[2],
          };
        } else {
          return {
            type,
            from: currentAgentId,
            summary: match[1],
          };
        }
      }
    }
    return null;
  }

  private extractTextContent(message: unknown): string {
    if (!message) return '';
    if (typeof message === 'string') return message;

    const msg = message as { content?: unknown; text?: string; role?: string };

    if (typeof msg.text === 'string') return msg.text;
    if (typeof msg.content === 'string') return msg.content;

    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((block: unknown) => (block as { type?: string })?.type === 'text')
        .map((block: unknown) => (block as { text?: string })?.text || '')
        .join('');
    }

    return '';
  }
}
