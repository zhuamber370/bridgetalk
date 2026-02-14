import type { Adapter } from './adapter.js';
import type { Task, IntentScore, ExecutionEvent, HealthStatus } from '@openclaw/shared';
import { INTENT_PATTERNS } from '@openclaw/shared';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class MockAdapter implements Adapter {
  id = 'mock';
  name = 'Mock Adapter';
  version = '1.0.0';

  private cancelledTasks = new Set<string>();

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
      confidence: Math.min(Math.max(maxScore, 0.75), 0.95),
      intent: matchedIntent,
    };
  }

  async *execute(task: Task): AsyncGenerator<ExecutionEvent> {
    this.cancelledTasks.delete(task.id);

    // Log: 开始执行
    yield {
      type: 'log',
      timestamp: Date.now(),
      data: { message: `开始执行任务: ${task.title}` },
    };

    await sleep(800);
    if (this.cancelledTasks.has(task.id)) return;

    // Progress: 30%
    yield {
      type: 'progress',
      timestamp: Date.now(),
      data: { percent: 30, message: '正在分析任务内容...' },
    };

    await sleep(1000);
    if (this.cancelledTasks.has(task.id)) return;

    // Log: 中间步骤
    yield {
      type: 'log',
      timestamp: Date.now(),
      data: { message: '已识别任务意图，正在执行...' },
    };

    // Progress: 70%
    yield {
      type: 'progress',
      timestamp: Date.now(),
      data: { percent: 70, message: '正在获取结果...' },
    };

    await sleep(1200);
    if (this.cancelledTasks.has(task.id)) return;

    // Result
    yield {
      type: 'result',
      timestamp: Date.now(),
      data: {
        success: true,
        message: `任务「${task.title}」已完成执行。`,
        summary: this.generateMockResult(task),
      },
    };
  }

  cancel(taskId: string): void {
    this.cancelledTasks.add(taskId);
  }

  health(): HealthStatus {
    return { status: 'healthy' };
  }

  private generateMockResult(task: Task): string {
    const content = task.content;
    if (content.includes('快递') || content.includes('查')) {
      return '快递已到达北京转运中心，预计明天送达。';
    }
    if (content.includes('搜索') || content.includes('找')) {
      return '已为您找到3条相关结果，请查看详情。';
    }
    if (content.includes('文件') || content.includes('创建')) {
      return '文件已成功创建/修改。';
    }
    return '任务已成功完成，请查看结果。';
  }
}
