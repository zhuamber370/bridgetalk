import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { Adapter } from './adapter.js';
import type { Task, Message, ExecutionEvent, HealthStatus } from '@openclaw/shared';

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

  // Chat event listeners keyed by sessionKey
  private chatEventListeners = new Map<string, (payload: ChatEventPayload) => void>();

  // Map taskId → sessionKey for cancel
  private taskSessionMap = new Map<string, string>();

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
      });

      ws.on('message', (raw: WebSocket.RawData) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }

        // 认证握手：收到 connect.challenge → 发送 connect 请求
        if (msg.type === 'event' && (msg as WsEvent).event === 'connect.challenge') {
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
              scopes: ['operator.read', 'operator.write'],
              caps: [],
              commands: [],
              permissions: {},
              auth: { token: this.gatewayToken },
              locale: 'zh-CN',
              userAgent: 'openclaw-agent-inbox/1.0.0',
            },
          };

          this.pendingRequests.set(connectReq.id, {
            resolve: (res) => {
              if (res.ok) {
                this.authenticated = true;
                settle();
              } else {
                const errMsg = typeof res.error === 'string'
                  ? res.error
                  : (res.error as { message?: string })?.message || JSON.stringify(res.error);
                settle(new Error(`认证失败: ${errMsg}`));
              }
            },
            reject: (err) => settle(err),
          });

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

  // ─── Execute Task (首次创建任务) ───

  async *execute(task: Task, history: Message[]): AsyncGenerator<ExecutionEvent> {
    this.cancelledTasks.delete(task.id);
    yield* this.chatSend(task.id, task.title, history);
  }

  // ─── Send Message (在已有任务中追加消息) ───

  async *sendMessage(taskId: string, _content: string, history: Message[]): AsyncGenerator<ExecutionEvent> {
    const title = history[0]?.content.slice(0, 20) || '任务';
    yield* this.chatSend(taskId, title, history);
  }

  // ─── Build prompt with conversation history ───

  private static readonly SYSTEM_PROMPT = `你是一个任务助手。用户会通过简短的自然语言给你派任务。

## 核心规则

1. **信息不足时，先提问再执行。** 如果用户的描述不够清晰或缺少关键信息，你必须提出具体的澄清问题。每次只问1-3个最关键的问题。不要猜测，不要假设。

2. **信息充足后，生成标题再执行。** 当你认为已经掌握了足够信息来执行任务时，在回复的第一行用以下格式生成任务标题：
   [TITLE: 简洁的任务标题]
   然后在下面给出你的执行结果。标题要求：10字以内，动词开头，描述核心动作。

3. **判断信息是否充足的标准：**
   - 任务目标明确（做什么）
   - 关键约束清楚（怎么做、有什么限制）
   - 没有歧义或多种理解

4. **不要做任务管理。** 你只负责当前这一个任务。不要建议用户创建新任务，不要判断用户的消息是否属于其他任务，不要提供任务分类或拆分建议。任务的创建和管理完全由用户自己决定。

## 示例

用户说"帮我订机票" → 信息不足，你应该问：去哪里？什么时间？几个人？
用户说"查一下顺丰SF1234567" → 信息充足，直接执行，回复：[TITLE: 查顺丰快递SF1234567]

## 对话历史

以下是本任务的完整对话记录：`;

  private buildPrompt(title: string, history: Message[]): string {
    const parts: string[] = [OpenClawAdapter.SYSTEM_PROMPT, ''];
    for (const msg of history) {
      const role = msg.senderType === 'user' ? '用户' : '助手';
      parts.push(`${role}: ${msg.content}`);
    }
    return parts.join('\n');
  }

  // ─── 核心：发送消息到 Gateway 并等待完整回复 ───

  private async *chatSend(taskId: string, title: string, history: Message[]): AsyncGenerator<ExecutionEvent> {
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

    // 所有任务共用同一个 session，任务隔离靠 prompt 上下文
    const sessionKey = 'agent:main:main';
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
      const prompt = this.buildPrompt(title, history);

      const res = await this.sendRequest('chat.send', {
        sessionKey,
        message: prompt,
        idempotencyKey: randomUUID(),
      });

      if (!res.ok) {
        const errMsg = typeof res.error === 'string'
          ? res.error
          : (res.error as { message?: string })?.message || JSON.stringify(res.error);
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
