import type { Adapter } from './adapter.js';
import type { Task, IntentScore, ExecutionEvent, HealthStatus, ConfirmationCheck, ValidationResult } from '@openclaw/shared';
import { INTENT_PATTERNS, ALLOWED_TOOLS, DANGEROUS_PATTERNS, WARNING_PATTERNS } from '@openclaw/shared';

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || '';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const GATEWAY_TIMEOUT = Number(process.env.OPENCLAW_GATEWAY_TIMEOUT) || 300_000; // 5 min

export class OpenClawAdapter implements Adapter {
  id = 'openclaw';
  name = 'OpenClaw Gateway';
  version = '1.0.0';

  private gatewayUrl: string;
  private gatewayToken: string;
  private timeoutMs: number;
  private cancelledTasks = new Set<string>();
  private abortControllers = new Map<string, AbortController>();

  constructor() {
    this.gatewayUrl = GATEWAY_URL.replace(/\/+$/, '');
    this.gatewayToken = GATEWAY_TOKEN;
    this.timeoutMs = GATEWAY_TIMEOUT;
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

  // ─── Execute Task via Gateway ───

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
      data: { percent: 10, message: '正在创建会话...' },
    };

    try {
      const controller = new AbortController();
      this.abortControllers.set(task.id, controller);

      // Set timeout
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      // Determine tools based on intent
      const intentTools = this.selectToolsForIntent(task.intent);

      // Create session and send task
      const response = await fetch(`${this.gatewayUrl}/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.gatewayToken}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          command: task.content,
          tools: intentTools,
          stream: true,
          metadata: {
            taskId: task.id,
            intent: task.intent,
            priority: task.priority,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        const errBody = await response.text();
        yield {
          type: 'error',
          timestamp: Date.now(),
          data: { message: `Gateway 错误 (${response.status}): ${errBody}` },
        };
        return;
      }

      if (this.cancelledTasks.has(task.id)) {
        clearTimeout(timeoutId);
        return;
      }

      yield {
        type: 'progress',
        timestamp: Date.now(),
        data: { percent: 30, message: '会话已建立，正在执行...' },
      };

      // Parse SSE stream from Gateway
      const reader = response.body?.getReader();
      if (!reader) {
        clearTimeout(timeoutId);
        yield { type: 'error', timestamp: Date.now(), data: { message: '无法读取 Gateway 响应流' } };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullOutput = '';
      let lastProgressPercent = 30;

      while (true) {
        if (this.cancelledTasks.has(task.id)) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          let event: GatewayEvent;
          try {
            event = JSON.parse(trimmed.slice(6));
          } catch {
            continue;
          }

          // Process different event types from Gateway
          const yieldEvent = this.processGatewayEvent(event, task.id);
          if (!yieldEvent) continue;

          // Tool whitelist enforcement
          if (event.type === 'tool_call') {
            const toolName = (event.data as { tool?: string })?.tool || '';
            const validation = this.validateToolCall(toolName);
            if (!validation.valid) {
              yield {
                type: 'log',
                timestamp: Date.now(),
                data: { message: `[安全] 已拦截工具调用: ${validation.reason}` },
              };
              continue;
            }

            // Dangerous command detection for exec tool
            if (toolName === 'exec') {
              const command = (event.data as { params?: { command?: string } })?.params?.command || '';
              const check = this.checkDangerousCommand(command);
              if (check.requiresConfirmation) {
                yield {
                  type: 'log',
                  timestamp: Date.now(),
                  data: {
                    message: `[安全] ${check.level === 'danger' ? '⚠️ 高危' : '⚡ 警告'}: ${check.reason} — ${check.detail}`,
                    confirmationRequired: true,
                    level: check.level,
                  },
                };
              }
            }
          }

          // Update progress incrementally
          if (event.type === 'output' || event.type === 'log') {
            const content = (event.data as { content?: string })?.content || '';
            fullOutput += content;
            lastProgressPercent = Math.min(lastProgressPercent + 5, 90);
            yield {
              type: 'progress',
              timestamp: Date.now(),
              data: { percent: lastProgressPercent, message: '执行中...' },
            };
          }

          yield yieldEvent;
        }
      }

      clearTimeout(timeoutId);
      this.abortControllers.delete(task.id);

      if (this.cancelledTasks.has(task.id)) return;

      // Yield final result
      yield {
        type: 'result',
        timestamp: Date.now(),
        data: {
          success: true,
          message: fullOutput || '任务执行完成',
          summary: fullOutput.length > 200 ? fullOutput.slice(0, 200) + '...' : fullOutput || '任务执行完成',
        },
      };
    } catch (err) {
      this.abortControllers.delete(task.id);

      if ((err as Error).name === 'AbortError') {
        if (this.cancelledTasks.has(task.id)) return;
        yield {
          type: 'error',
          timestamp: Date.now(),
          data: { message: `Gateway 请求超时 (${this.timeoutMs / 1000}s)` },
        };
        return;
      }

      yield {
        type: 'error',
        timestamp: Date.now(),
        data: { message: `Gateway 通信失败: ${(err as Error).message}` },
      };
    }
  }

  // ─── Cancel ───

  cancel(taskId: string): void {
    this.cancelledTasks.add(taskId);
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
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
    return { status: 'healthy' };
  }

  // ─── Private Helpers ───

  private selectToolsForIntent(intent: string): string[] {
    const pattern = INTENT_PATTERNS.find(p => p.intent === intent);
    if (pattern && pattern.tools.length > 0) {
      return pattern.tools.filter(t => (ALLOWED_TOOLS as readonly string[]).includes(t));
    }
    // General intent: allow all whitelisted tools
    return [...ALLOWED_TOOLS];
  }

  private processGatewayEvent(event: GatewayEvent, _taskId: string): ExecutionEvent | null {
    switch (event.type) {
      case 'output':
      case 'log':
        return {
          type: 'log',
          timestamp: Date.now(),
          data: { message: (event.data as { content?: string })?.content || '' },
        };

      case 'result':
        return {
          type: 'result',
          timestamp: Date.now(),
          data: event.data,
        };

      case 'error':
        return {
          type: 'error',
          timestamp: Date.now(),
          data: { message: (event.data as { message?: string })?.message || '执行出错' },
        };

      case 'tool_call':
        return {
          type: 'log',
          timestamp: Date.now(),
          data: {
            message: `[工具调用] ${(event.data as { tool?: string })?.tool || 'unknown'}`,
          },
        };

      case 'progress':
        return {
          type: 'progress',
          timestamp: Date.now(),
          data: event.data,
        };

      default:
        return null;
    }
  }
}

// ─── Gateway Event Type ───

interface GatewayEvent {
  type: 'output' | 'log' | 'result' | 'error' | 'tool_call' | 'progress';
  data: unknown;
}
