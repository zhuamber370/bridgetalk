import { generateId, nowMs } from '@openclaw/shared';
import type { Task, Update } from '@openclaw/shared';
import type { Adapter } from '../adapters/adapter.js';
import { Repository } from '../db/repository.js';
import { EventBroadcaster } from './event-broadcaster.js';
import { MessageHub } from './message-hub.js';

export class TaskExecutor {
  constructor(
    private repo: Repository,
    private adapter: Adapter,
    private broadcaster: EventBroadcaster,
    private messageHub: MessageHub,
  ) {}

  async executeTask(task: Task): Promise<void> {
    // Transition to running
    this.repo.updateTask(task.id, { status: 'running' });
    this.broadcaster.broadcast('task.updated', { taskId: task.id, status: 'running' }, task.id);

    try {
      for await (const event of this.adapter.execute(task)) {
        // Create a message for each execution event
        const msg = this.messageHub.sendAgentMessage(task.id, this.formatEventContent(event), {
          contentType: event.type === 'result' ? 'task_update' : 'text',
        });

        // Create an update record
        const update: Update = {
          id: generateId(),
          taskId: task.id,
          messageId: msg.id,
          type: event.type === 'result' ? 'result' : event.type === 'error' ? 'error' : event.type === 'progress' ? 'progress' : 'log',
          title: this.getEventTitle(event.type),
          content: this.formatEventContent(event),
          payload: event.data,
          createdAt: nowMs(),
        };
        this.repo.createUpdate(update);

        this.broadcaster.broadcast('update.created', { taskId: task.id, update }, task.id);
        this.broadcaster.broadcast('message.created', { taskId: task.id, message: msg }, task.id);

        // If error, mark task as failed
        if (event.type === 'error') {
          this.repo.updateTask(task.id, { status: 'failed', completedAt: nowMs() });
          this.broadcaster.broadcast('task.failed', { taskId: task.id, status: 'failed' }, task.id);
          return;
        }
      }

      // Mark task as completed
      this.repo.updateTask(task.id, { status: 'completed', completedAt: nowMs() });
      this.broadcaster.broadcast('task.completed', { taskId: task.id, status: 'completed' }, task.id);
    } catch (err) {
      const errorMessage = (err as Error).message || '执行出错';
      this.messageHub.sendAgentMessage(task.id, `执行失败: ${errorMessage}`);
      this.repo.updateTask(task.id, { status: 'failed', completedAt: nowMs() });
      this.broadcaster.broadcast('task.failed', { taskId: task.id, status: 'failed', error: errorMessage }, task.id);
    }
  }

  cancelTask(taskId: string): void {
    this.adapter.cancel(taskId);
  }

  private formatEventContent(event: { type: string; data: unknown }): string {
    const data = event.data as Record<string, unknown>;
    if (data.message) return data.message as string;
    if (data.summary) return data.summary as string;
    if (data.percent !== undefined) return `进度: ${data.percent}% - ${data.message || ''}`;
    return JSON.stringify(data);
  }

  private getEventTitle(type: string): string {
    switch (type) {
      case 'log': return '执行日志';
      case 'progress': return '执行进度';
      case 'result': return '执行结果';
      case 'error': return '执行错误';
      default: return '更新';
    }
  }
}
