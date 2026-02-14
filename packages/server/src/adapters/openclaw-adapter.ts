import WebSocket from 'ws';
import type { Adapter } from './adapter.js';
import type { Task, IntentScore, ExecutionEvent, HealthStatus, ConfirmationCheck, ValidationResult } from '@openclaw/shared';
import { INTENT_PATTERNS, ALLOWED_TOOLS, DANGEROUS_PATTERNS, WARNING_PATTERNS } from '@openclaw/shared';

// ─── WebSocket Protocol Types ───

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
  error?: string;
}

interface WsEvent {
  type: 'event';
  event: string;
  payload: unknown;
  seq?: number;
}

type WsMessage = WsResponse | WsEvent | { type: string; [key: string]: unknown };

export class OpenClawAdapter implements Adapter {
  id = 'openclaw';
  name = 'OpenClaw Gateway';
  version = '1.0.0';

  private gatewayUrl: string;
  private gatewayToken: string;
  private timeoutMs: number;
  private cancelledTasks = new Set<string>();

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

  // Event listeners per task
  private taskEventListeners = new Map<string, (event: WsEvent) => void>();

  constructor() {
    const rawUrl = (process.env.OPENCLAW_GATEWAY_URL || '').replace(/\/+$/, '');
    this.gatewayUrl = this.normalizeWsUrl(rawUrl);
    this.gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || '';
    this.timeoutMs = Number(process.env.OPENCLAW_GATEWAY_TIMEOUT) || 300_000;
  }

  // ─── URL Normalization ───

  private normalizeWsUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://')) return url.replace('http://', 'ws://');
    if (url.startsWith('https://')) return url.replace('https://', 'wss://');
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) return `ws://${url}`;
    return url;
  }

  // ─── Intent Scoring ───

  scoreIntent(content: string): IntentScore {
    let maxScore = 0;
    let matchedIntent = 'general';

    for (const pattern of INTENT_PATTERNS) {
      const matchCount = pattern.keywords.filter(kw => content.includes(kw)).length;
      if (matchCount === 0) continue;
      const score = (matchCount / pattern.keywords.length) * (1 + pattern.confidenceBoost);
      if (score > maxScore) {
        maxScore = score;
        matchedIntent = pattern.intent;
      }
    }

    return {
      matched: maxScore > 0.3,
      confidence: Math.min(Math.max(maxScore, 0.8), 0.95),
      intent: matchedIntent,
    };
  }

  // ─── Tool Whitelist Validation ───

  private validateToolCall(tool: string): ValidationResult {
    if (!(ALLOWED_TOOLS as readonly string[]).includes(tool)) {
      return { valid: false, reason: `工具 "${tool}" 不在白名单中` };
    }
    return { valid: true };
  }

  // ─── Dangerous Command Detection ───

  private checkDangerousCommand(command: string): ConfirmationCheck {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return {
          requiresConfirmation: true,
          level: 'danger',
          reason: '检测到高危操作',
          detail: `命令匹配危险模式: ${command.slice(0, 100)}`,
        };
      }
    }

    for (const pattern of WARNING_PATTERNS) {
      if (pattern.test(command)) {
        return {
          requiresConfirmation: true,
          level: 'warning',
          reason: '需要系统级权限',
          detail: `该命令可能影响系统运行: ${command.slice(0, 100)}`,
        };
      }
    }

    return { requiresConfirmation: false };
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
    await this.connect();
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
        // 等待服务器发送 nonce 事件来开始认证
      });

      ws.on('message', (raw: WebSocket.RawData) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }

        // 处理认证握手：服务器发送 nonce
        if (msg.type === 'event' && (msg as WsEvent).event === 'nonce') {
          const nonce = ((msg as WsEvent).payload as { nonce?: string })?.nonce;
          const connectReq: WsRequest = {
            type: 'req',
            id: this.nextReqId(),
            method: 'connect',
            params: {
              token: `Bearer ${this.gatewayToken}`,
              role: 'operator',
              nonce,
            },
          };

          // 监听 connect 响应
          this.pendingRequests.set(connectReq.id, {
            resolve: (res) => {
              if (res.ok) {
                this.authenticated = true;
                settle();
              } else {
                settle(new Error(`认证失败: ${res.error || '未知错误'}`));
              }
            },
            reject: (err) => settle(err),
          });

          ws.send(JSON.stringify(connectReq));
          return;
        }

        // 处理响应帧
        if (msg.type === 'res') {
          const res = msg as WsResponse;
          const pending = this.pendingRequests.get(res.id);
          if (pending) {
            this.pendingRequests.delete(res.id);
            pending.resolve(res);
          }
          return;
        }

        // 处理事件帧 → 分发给对应 task 监听器
        if (msg.type === 'event') {
          const evt = msg as WsEvent;
          const taskId = (evt.payload as { taskId?: string })?.taskId;
          if (taskId) {
            const listener = this.taskEventListeners.get(taskId);
            if (listener) listener(evt);
          }
        }
      });

      ws.on('error', (err) => {
        settle(new Error(`WebSocket 错误: ${err.message}`));
      });

      ws.on('close', (_code, _reason) => {
        this.authenticated = false;
        this.ws = null;
        settle(new Error('WebSocket 连接关闭'));

        // 拒绝所有 pending 请求
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
        // connect 失败会触发 close，close 会再次调度重连
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

  // ─── Execute Task via Gateway (WebSocket) ───

  async *execute(task: Task): AsyncGenerator<ExecutionEvent> {
    this.cancelledTasks.delete(task.id);

    if (!this.gatewayUrl) {
      yield {
        type: 'error',
        timestamp: Date.now(),
        data: { message: 'OpenClaw Gateway 未配置，请设置 OPENCLAW_GATEWAY_URL 环境变量' },
      };
      return;
    }

    yield {
      type: 'log',
      timestamp: Date.now(),
      data: { message: `正在连接 OpenClaw Gateway: ${this.gatewayUrl}` },
    };

    yield {
      type: 'progress',
      timestamp: Date.now(),
      data: { percent: 10, message: '正在建立 WebSocket 连接...' },
    };

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

    if (this.cancelledTasks.has(task.id)) return;

    yield {
      type: 'progress',
      timestamp: Date.now(),
      data: { percent: 20, message: '已连接，正在发送任务...' },
    };

    // 用事件队列桥接 WS 回调和 AsyncGenerator
    const eventQueue: (ExecutionEvent | null)[] = [];
    let queueResolve: (() => void) | null = null;
    let fullOutput = '';
    let lastProgressPercent = 30;

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

    // 注册事件监听器
    this.taskEventListeners.set(task.id, (wsEvent: WsEvent) => {
      const gatewayEvent = this.convertWsEvent(wsEvent);
      if (!gatewayEvent) return;

      // 工具白名单检查
      if (wsEvent.event === 'tool_call') {
        const toolName = (wsEvent.payload as { tool?: string })?.tool || '';
        const validation = this.validateToolCall(toolName);
        if (!validation.valid) {
          pushEvent({
            type: 'log',
            timestamp: Date.now(),
            data: { message: `[安全] 已拦截工具调用: ${validation.reason}` },
          });
          return;
        }

        // 危险命令检测
        if (toolName === 'exec') {
          const command = (wsEvent.payload as { params?: { command?: string } })?.params?.command || '';
          const check = this.checkDangerousCommand(command);
          if (check.requiresConfirmation) {
            pushEvent({
              type: 'log',
              timestamp: Date.now(),
              data: {
                message: `[安全] ${check.level === 'danger' ? '⚠️ 高危' : '⚡ 警告'}: ${check.reason} — ${check.detail}`,
                confirmationRequired: true,
                level: check.level,
              },
            });
          }
        }
      }

      // 进度更新
      if (wsEvent.event === 'output' || wsEvent.event === 'log') {
        const content = (wsEvent.payload as { content?: string })?.content || '';
        fullOutput += content;
        lastProgressPercent = Math.min(lastProgressPercent + 5, 90);
        pushEvent({
          type: 'progress',
          timestamp: Date.now(),
          data: { percent: lastProgressPercent, message: '执行中...' },
        });
      }

      pushEvent(gatewayEvent);

      // 完成或错误时结束生成器
      if (wsEvent.event === 'result' || wsEvent.event === 'error' || wsEvent.event === 'done') {
        pushEvent(null); // sentinel: end of stream
      }
    });

    try {
      // 发送执行请求
      const intentTools = this.selectToolsForIntent(task.intent);
      const res = await this.sendRequest('execute', {
        command: task.content,
        tools: intentTools,
        metadata: {
          taskId: task.id,
          intent: task.intent,
          priority: task.priority,
        },
      });

      if (!res.ok) {
        yield {
          type: 'error',
          timestamp: Date.now(),
          data: { message: `Gateway 执行失败: ${res.error || '未知错误'}` },
        };
        return;
      }

      yield {
        type: 'progress',
        timestamp: Date.now(),
        data: { percent: 30, message: '任务已提交，正在执行...' },
      };

      // 设置超时
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
        if (this.cancelledTasks.has(task.id)) {
          clearTimeout(timeoutTimer);
          break;
        }

        await waitForEvent();

        while (eventQueue.length > 0) {
          const evt = eventQueue.shift()!;
          if (evt === null) {
            clearTimeout(timeoutTimer);
            // 生成最终结果（如果还没有收到 result 事件）
            if (fullOutput) {
              yield {
                type: 'result',
                timestamp: Date.now(),
                data: {
                  success: true,
                  message: fullOutput,
                  summary: fullOutput.length > 200 ? fullOutput.slice(0, 200) + '...' : fullOutput,
                },
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
      this.taskEventListeners.delete(task.id);
    }
  }

  // ─── Cancel ───

  cancel(taskId: string): void {
    this.cancelledTasks.add(taskId);
    this.taskEventListeners.delete(taskId);

    // 向 Gateway 发送取消请求（fire-and-forget）
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.sendRequest('cancel', { taskId }, 5_000).catch(() => {});
    }
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

  private selectToolsForIntent(intent: string): string[] {
    const pattern = INTENT_PATTERNS.find(p => p.intent === intent);
    if (pattern && pattern.tools.length > 0) {
      return pattern.tools.filter(t => (ALLOWED_TOOLS as readonly string[]).includes(t));
    }
    return [...ALLOWED_TOOLS];
  }

  private convertWsEvent(wsEvent: WsEvent): ExecutionEvent | null {
    switch (wsEvent.event) {
      case 'output':
      case 'log':
        return {
          type: 'log',
          timestamp: Date.now(),
          data: { message: (wsEvent.payload as { content?: string })?.content || '' },
        };

      case 'result':
        return {
          type: 'result',
          timestamp: Date.now(),
          data: wsEvent.payload,
        };

      case 'error':
        return {
          type: 'error',
          timestamp: Date.now(),
          data: { message: (wsEvent.payload as { message?: string })?.message || '执行出错' },
        };

      case 'tool_call':
        return {
          type: 'log',
          timestamp: Date.now(),
          data: {
            message: `[工具调用] ${(wsEvent.payload as { tool?: string })?.tool || 'unknown'}`,
          },
        };

      case 'progress':
        return {
          type: 'progress',
          timestamp: Date.now(),
          data: wsEvent.payload,
        };

      case 'done':
        return null;

      default:
        return null;
    }
  }
}
