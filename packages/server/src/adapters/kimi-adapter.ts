import type { Adapter } from './adapter.js';
import type { Task, IntentScore, ExecutionEvent, HealthStatus } from '@openclaw/shared';
import { INTENT_PATTERNS } from '@openclaw/shared';

const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1';
const KIMI_API_KEY = process.env.KIMI_API_KEY || '';
const KIMI_MODEL = process.env.KIMI_MODEL || 'kimi-k2.5';

export class KimiAdapter implements Adapter {
  id = 'kimi';
  name = 'Kimi K2.5';
  version = '1.0.0';

  private cancelledTasks = new Set<string>();
  private abortControllers = new Map<string, AbortController>();

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
      matched: true,
      confidence: Math.min(Math.max(maxScore, 0.8), 0.95),
      intent: matchedIntent,
    };
  }

  async *execute(task: Task): AsyncGenerator<ExecutionEvent> {
    this.cancelledTasks.delete(task.id);

    if (!KIMI_API_KEY) {
      yield {
        type: 'error',
        timestamp: Date.now(),
        data: { message: '未配置 KIMI_API_KEY，请设置环境变量' },
      };
      return;
    }

    yield {
      type: 'log',
      timestamp: Date.now(),
      data: { message: `正在调用 Kimi K2.5 处理: ${task.title}` },
    };

    yield {
      type: 'progress',
      timestamp: Date.now(),
      data: { percent: 20, message: '已发送请求到 Kimi...' },
    };

    try {
      const controller = new AbortController();
      this.abortControllers.set(task.id, controller);

      const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${KIMI_API_KEY}`,
        },
        body: JSON.stringify({
          model: KIMI_MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个高效的AI助手。用户会给你一个任务，请直接完成任务并给出结果。回复使用中文，保持简洁。',
            },
            {
              role: 'user',
              content: task.content,
            },
          ],
          stream: true,
          temperature: 0.6,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        yield {
          type: 'error',
          timestamp: Date.now(),
          data: { message: `Kimi API 错误 (${response.status}): ${errBody}` },
        };
        return;
      }

      if (this.cancelledTasks.has(task.id)) return;

      yield {
        type: 'progress',
        timestamp: Date.now(),
        data: { percent: 50, message: 'Kimi 正在生成回复...' },
      };

      // 解析 SSE 流
      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', timestamp: Date.now(), data: { message: '无法读取响应流' } };
        return;
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        if (this.cancelledTasks.has(task.id)) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按行解析 SSE
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta;

            if (delta?.content) {
              fullContent += delta.content;
            }
          } catch {
            // 跳过无法解析的行
          }
        }
      }

      this.abortControllers.delete(task.id);

      if (this.cancelledTasks.has(task.id)) return;

      if (!fullContent) {
        yield {
          type: 'error',
          timestamp: Date.now(),
          data: { message: 'Kimi 返回了空响应' },
        };
        return;
      }

      yield {
        type: 'result',
        timestamp: Date.now(),
        data: {
          success: true,
          message: fullContent,
          summary: fullContent.length > 200 ? fullContent.slice(0, 200) + '...' : fullContent,
        },
      };
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;

      yield {
        type: 'error',
        timestamp: Date.now(),
        data: { message: `Kimi 调用失败: ${(err as Error).message}` },
      };
    }
  }

  cancel(taskId: string): void {
    this.cancelledTasks.add(taskId);
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
    }
  }

  health(): HealthStatus {
    if (!KIMI_API_KEY) {
      return { status: 'unavailable', message: 'KIMI_API_KEY 未配置' };
    }
    return { status: 'healthy' };
  }
}
