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
  private devicePrivateKey: string | null = null; // 用于签名
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

  // 🆕 全局 chat 事件监听器（接收所有 chat 事件，无论 sessionKey）
  private globalChatListener: ((payload: ChatEventPayload) => void) | null = null;

  // Map taskId → sessionKey for cancel
  private taskSessionMap = new Map<string, string>();

  // 🆕 已知的 sessionKey 集合（用于检测新的子 agent 活动）
  private knownSessionKeys = new Set<string>();
  private readonly requiredScopes = [
    'operator.read',
    'operator.write',
    'operator.pairing',      // 设备配对
    'operator.approvals',    // 执行审批
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
   * 确保 device identity 已加载或生成
   * 1. 尝试加载已保存的 keypair
   * 2. 如果不存在，生成新的 Ed25519 keypair 并保存
   * 3. 计算 device ID (SHA256 of publicKey)
   * 4. 尝试加载 device token（如果存在）
   */
  private async ensureDeviceIdentity(): Promise<void> {
    if (this.deviceId && this.devicePublicKey) return;

    // 确保配置目录存在
    try {
      await fs.mkdir(this.deviceConfigDir, { recursive: true, mode: 0o700 });
    } catch (err) {
      console.error('创建设备配置目录失败:', err);
    }

    const keypairPath = join(this.deviceConfigDir, 'device-keypair.json');
    let keypair: DeviceKeyPair;

    try {
      // 尝试加载已存在的 keypair
      const data = await fs.readFile(keypairPath, 'utf-8');
      keypair = JSON.parse(data);
      console.log('[Device Identity] 已加载现有 keypair');
    } catch {
      // keypair 不存在，生成新的
      console.log('[Device Identity] 生成新的 Ed25519 keypair');
      const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      });

      keypair = {
        publicKey: publicKey.toString('base64'),
        privateKey: privateKey.toString('base64'),
      };

      // 保存 keypair 到文件（权限 0600）
      await fs.writeFile(keypairPath, JSON.stringify(keypair, null, 2), { mode: 0o600 });
      console.log('[Device Identity] Keypair 已保存到:', keypairPath);
    }

    // 从 SPKI DER 格式提取原始 32 字节 Ed25519 公钥
    // SPKI DER 格式: [12 bytes ASN.1 header][32 bytes raw public key]
    const publicKeyDER = Buffer.from(keypair.publicKey, 'base64');
    const rawPublicKey = publicKeyDER.slice(-32); // 取最后 32 字节
    const rawPublicKeyBase64 = rawPublicKey.toString('base64');

    // 计算 device ID (SHA256 of raw publicKey, hex string)
    this.deviceId = createHash('sha256').update(rawPublicKey).digest('hex');
    this.devicePublicKey = rawPublicKeyBase64; // 使用原始公钥
    this.devicePrivateKey = keypair.privateKey; // 保存 DER 私钥用于签名

    console.log('[Device Identity] Device ID:', this.deviceId);
    console.log('[Device Identity] Raw Public Key:', rawPublicKeyBase64);

    // 尝试加载 device token
    const tokenPath = join(this.deviceConfigDir, 'device-token.json');
    try {
      const tokenData = await fs.readFile(tokenPath, 'utf-8');
      const { token, expiresAt } = JSON.parse(tokenData) as DeviceToken;

      // 检查 token 是否过期
      if (!expiresAt || expiresAt > Date.now()) {
        this.deviceToken = token;
        console.log('[Device Identity] 已加载 device token');
      } else {
        console.log('[Device Identity] Device token 已过期');
      }
    } catch {
      console.log('[Device Identity] 未找到 device token，将使用 gateway token');
    }
  }

  /**
   * 保存从 Gateway 返回的 device token
   */
  private async saveDeviceToken(token: string, expiresAt?: number): Promise<void> {
    const tokenPath = join(this.deviceConfigDir, 'device-token.json');
    const tokenData: DeviceToken = { token, expiresAt };

    try {
      await fs.writeFile(tokenPath, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
      this.deviceToken = token;
      console.log('[Device Identity] Device token 已保存');
    } catch (err) {
      console.error('[Device Identity] 保存 device token 失败:', err);
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
        console.warn('[Device Identity] 签名失败，将发送空签名:', err);
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
      console.log(`[Device Identity] 已清理 device token（${reason}）`);
    } catch (err) {
      console.warn('[Device Identity] 清理 device token 失败:', err);
    }
  }

  /**
   * 发起设备配对请求（使用 node.pair.request RPC）
   */
  private async requestDevicePairing(): Promise<string> {
    console.log('[Device Pairing] 发起配对请求...');

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket 未连接'));
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
            console.log('[Device Pairing] ✓ 配对请求已创建');
            console.log('[Device Pairing] Request ID:', requestId);
            console.log('[Device Pairing] 请运行以下命令批准配对:');
            console.log(`[Device Pairing]   openclaw nodes approve ${requestId}`);
            resolve(requestId);
          } else {
            const errMsg = typeof res.error === 'string'
              ? res.error
              : (res.error as { message?: string })?.message || JSON.stringify(res.error);
            reject(new Error(`配对请求失败: ${errMsg}`));
          }
        },
        reject: (err) => reject(err),
      });

      this.ws.send(JSON.stringify(pairReq));
      console.log('[Device Pairing] 已发送 node.pair.request');
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
    // 连接前先确保 device identity 已准备好
    await this.ensureDeviceIdentity();
    try {
      await this.connect();
    } catch (err) {
      const errMsg = (err as Error).message;
      if (this.deviceToken && (this.hasMissingScopeError(errMsg) || this.hasDeviceTokenMismatchError(errMsg))) {
        const reason = this.hasDeviceTokenMismatchError(errMsg) ? 'token 不匹配' : 'scope 不足';
        console.log(`[Connect] device token ${reason}，回退到 gateway token 重试...`);
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
          reject(new Error('WebSocket 连接失败'));
        }
      }, 100);
      const timeout = setTimeout(() => {
        clearInterval(check);
        reject(new Error('等待 WebSocket 连接超时'));
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
        settle(new Error('WebSocket 握手超时 (15s)'));
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

        // 认证握手：收到 connect.challenge → 发送配对请求或 connect 请求
        if (msg.type === 'event' && (msg as WsEvent).event === 'connect.challenge') {
          const evt = msg as WsEvent;
          const challengePayload = evt.payload as { nonce?: string };

          // 优先使用 device token，否则使用 gateway token（都通过 token 字段传递）
          const useDeviceToken = Boolean(this.deviceToken);
          this.usingDeviceTokenForConnection = useDeviceToken;
          const authParam = { token: useDeviceToken ? this.deviceToken : this.gatewayToken };
          console.log('[Connect] 使用', useDeviceToken ? 'device token' : 'gateway token', '认证');

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
              // 显式声明所有需要的 scopes (2026.2.14+ operator.admin 不再隐式包含其他 scopes)
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

                // 从 hello-ok 响应中提取 device token（如果存在）
                const payload = res.payload as { auth?: { deviceToken?: string; expiresAt?: number } };
                this.logScopeProbe(payload);
                if (payload?.auth?.deviceToken) {
                  await this.saveDeviceToken(
                    payload.auth.deviceToken,
                    payload.auth.expiresAt,
                  );
                }

                // Gateway 2026.2.14+ 对 pairing scope 更严格，默认不自动发起配对请求，
                // 避免影响核心 chat.send 能力；如需配对请手动执行 CLI 流程。

                settle();
              } else {
                console.log('[Connect Error] Full response:', JSON.stringify(res, null, 2));
                const errMsg = typeof res.error === 'string'
                  ? res.error
                  : (res.error as { message?: string })?.message || JSON.stringify(res.error);
                settle(new Error(`认证失败: ${errMsg}`));
              }
            },
            reject: (err) => settle(err),
          });

          console.log('[Connect Request] device:', JSON.stringify((connectReq.params as { device?: unknown }).device, null, 2));
          ws.send(JSON.stringify(connectReq));
          return;
        }

        // 响应帧 → 关联到 pending request
        if (msg.type === 'res') {
          const res = msg as WsResponse;
          const pending = this.pendingRequests.get(res.id);
          if (pending) {
            this.pendingRequests.delete(res.id);
            pending.resolve(res);
          }
          return;
        }

        // 事件帧
        if (msg.type === 'event') {
          const evt = msg as WsEvent;

          // chat 事件 → 分发给对应 sessionKey 的监听器
          if (evt.event === 'chat') {
            const payload = evt.payload as ChatEventPayload;
            if (payload?.sessionKey) {
              // 🆕 先调用全局监听器（用于检测新的子 agent 活动）
              if (this.globalChatListener) {
                this.globalChatListener(payload);
              }

              // 再调用特定 sessionKey 的监听器
              const listener = this.chatEventListeners.get(payload.sessionKey);
              if (listener) listener(payload);
            }
          }
        }
      });

      ws.on('error', (err) => {
        settle(new Error(`WebSocket 错误: ${err.message}`));
      });

      ws.on('close', (_code, _reason) => {
        this.authenticated = false;
        this.usingDeviceTokenForConnection = false;
        this.ws = null;
        settle(new Error('WebSocket 连接关闭'));

        for (const [id, pending] of this.pendingRequests) {
          pending.reject(new Error('WebSocket 连接断开'));
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
        // connect 失败会触发 close → 再次调度重连
      }
    }, delay);
  }

  private sendRequest(method: string, params: unknown, timeout?: number): Promise<WsResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket 未连接'));
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
        reject(new Error(`请求超时: ${method}`));
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
      console.log('[Scope Probe] Gateway 未返回可解析的 scopes 字段');
      console.log('[Scope Probe] Requested scopes:', requested.join(', '));
      return;
    }

    const missing = requested.filter((scope) => !granted.includes(scope));
    console.log('[Scope Probe] Requested scopes:', requested.join(', '));
    console.log('[Scope Probe] Granted scopes:', granted.join(', '));

    if (missing.length > 0) {
      console.warn('[Scope Probe] Missing scopes:', missing.join(', '));
    } else {
      console.log('[Scope Probe] 所有必需 scopes 已授予');
    }
  }

  // 🆕 注册全局 chat 事件监听器
  setGlobalChatListener(listener: (payload: ChatEventPayload) => void): void {
    this.globalChatListener = listener;
  }

  // 🆕 移除全局监听器
  removeGlobalChatListener(): void {
    this.globalChatListener = null;
  }

  // ─── Execute Task (首次创建任务) ───

  async *execute(task: Task, content: string): AsyncGenerator<ExecutionEvent> {
    this.cancelledTasks.delete(task.id);
    yield* this.chatSend(task.id, content, task.agentId);
  }

  // ─── Send Message (在已有任务中追加消息) ───

  async *sendMessage(task: Task, content: string): AsyncGenerator<ExecutionEvent> {
    yield* this.chatSend(task.id, content, task.agentId);
  }

  // ─── 核心：发送消息到 Gateway 并等待完整回复 ───

  private async *chatSend(taskId: string, content: string, agentId: string = 'main'): AsyncGenerator<ExecutionEvent> {
    if (!this.gatewayUrl) {
      yield {
        type: 'error',
        timestamp: Date.now(),
        data: { message: 'OpenClaw Gateway 未配置，请设置 OPENCLAW_GATEWAY_URL 环境变量' },
      };
      return;
    }

    try {
      await this.ensureConnected();
    } catch (err) {
      yield {
        type: 'error',
        timestamp: Date.now(),
        data: { message: `WebSocket 连接失败: ${(err as Error).message}` },
      };
      return;
    }

    if (this.cancelledTasks.has(taskId)) return;

    // 事件队列：桥接 WS 回调和 AsyncGenerator
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

    // 每个 Agent 独立 session，通过 agentId 动态构建 sessionKey
    const sessionKey = `agent:${agentId}:main`;
    this.taskSessionMap.set(taskId, sessionKey);

    // 注册 chat 事件监听器
    this.chatEventListeners.set(sessionKey, (payload: ChatEventPayload) => {
      if (this.cancelledTasks.has(taskId)) return;

      switch (payload.state) {
        case 'delta': {
          // delta 只累积文本，不 yield
          const deltaContent = this.extractTextContent(payload.message);
          if (deltaContent) {
            fullOutput = deltaContent;
          }
          break;
        }

        case 'final': {
          gotResult = true;
          const finalContent = this.extractTextContent(payload.message);
          const output = finalContent || fullOutput || '任务执行完成';

          // 检测协调标记
          const coordination = this.detectCoordination(output, agentId);
          if (coordination) {
            pushEvent({
              type: 'coordination',
              timestamp: Date.now(),
              data: coordination,
            });
          }

          // 继续推送常规结果
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
            data: { message: payload.errorMessage || '执行出错' },
          });
          pushEvent(null);
          break;
        }

        case 'aborted': {
          pushEvent({
            type: 'error',
            timestamp: Date.now(),
            data: { message: '任务已被中止' },
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

      // 设备 token 在 Gateway 升级后可能 scope 不足；自动回退 gateway token 并重试一次
      if (!res.ok && this.usingDeviceTokenForConnection) {
        const errMsg = this.extractGatewayError(res.error);
        if (this.hasMissingScopeError(errMsg) || this.hasDeviceTokenMismatchError(errMsg)) {
          const reason = this.hasDeviceTokenMismatchError(errMsg)
            ? 'chat.send token 不匹配'
            : 'chat.send scope 不足';
          console.log('[SendMessage] device token 不可用，回退到 gateway token 重试...');
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
          data: { message: `Gateway 执行失败: ${errMsg}` },
        };
        return;
      }

      // 超时保护
      const timeoutTimer = setTimeout(() => {
        pushEvent({
          type: 'error',
          timestamp: Date.now(),
          data: { message: `Gateway 请求超时 (${this.timeoutMs / 1000}s)` },
        });
        pushEvent(null);
      }, this.timeoutMs);

      // 消费事件队列
      while (true) {
        if (this.cancelledTasks.has(taskId)) {
          clearTimeout(timeoutTimer);
          break;
        }

        await waitForEvent();

        while (eventQueue.length > 0) {
          const evt = eventQueue.shift()!;
          if (evt === null) {
            clearTimeout(timeoutTimer);
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
        data: { message: `Gateway 通信失败: ${(err as Error).message}` },
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
      return { status: 'degraded', message: 'OPENCLAW_GATEWAY_TOKEN 未配置，可能无法认证' };
    }
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      return { status: 'healthy', message: 'WebSocket 已连接并认证' };
    }
    if (this.connecting) {
      return { status: 'degraded', message: 'WebSocket 正在连接中...' };
    }
    return { status: 'degraded', message: 'WebSocket 未连接（将在下次请求时自动连接）' };
  }

  // ─── Private Helpers ───

  // 协调检测：从 agent 输出中识别协调标记
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
