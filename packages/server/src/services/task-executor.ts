import { generateId, nowMs } from '@openclaw/shared';
import type { Message } from '@openclaw/shared';
import type { Adapter } from '../adapters/adapter.js';
import { Repository } from '../db/repository.js';
import { EventBroadcaster } from './event-broadcaster.js';

export class TaskExecutor {
  constructor(
    private repo: Repository,
    private adapter: Adapter,
    private broadcaster: EventBroadcaster,
  ) {}

  private handleAgentResult(taskId: string, content: string): void {
    const msg: Message = {
      id: generateId(),
      taskId,
      senderType: 'agent',
      content,
      timestamp: nowMs(),
    };
    this.repo.createMessage(msg);
    this.broadcaster.broadcast('message.created', { taskId, message: msg }, taskId);

    const completedTask = this.repo.updateTask(taskId, { status: 'completed', completedAt: nowMs() });
    this.broadcaster.broadcast('task.updated', { taskId, task: completedTask }, taskId);
  }

  private handleAgentError(taskId: string, errorMessage: string): void {
    const msg: Message = {
      id: generateId(),
      taskId,
      senderType: 'agent',
      content: errorMessage,
      timestamp: nowMs(),
    };
    this.repo.createMessage(msg);
    this.broadcaster.broadcast('message.created', { taskId, message: msg }, taskId);

    const failedTask = this.repo.updateTask(taskId, { status: 'failed', completedAt: nowMs() });
    this.broadcaster.broadcast('task.updated', { taskId, task: failedTask }, taskId);
  }

  async executeTask(taskId: string, content: string): Promise<void> {
    const task = this.repo.getTask(taskId);
    if (!task) return;

    const runningTask = this.repo.updateTask(task.id, { status: 'running' });
    this.broadcaster.broadcast('task.updated', { taskId: task.id, task: runningTask }, task.id);

    try {
      for await (const event of this.adapter.execute(task, content)) {
        if (event.type === 'result') {
          this.handleAgentResult(task.id, event.data.message);
        } else if (event.type === 'error') {
          this.handleAgentError(task.id, event.data.message);
        }
      }
    } catch (err) {
      this.handleAgentError(task.id, `执行失败: ${(err as Error).message || '执行出错'}`);
    }
  }

  async sendMessage(taskId: string, content: string): Promise<void> {
    const task = this.repo.getTask(taskId);
    if (!task) return;

    const userMsg: Message = {
      id: generateId(),
      taskId,
      senderType: 'user',
      content,
      timestamp: nowMs(),
    };
    this.repo.createMessage(userMsg);
    this.broadcaster.broadcast('message.created', { taskId, message: userMsg }, taskId);

    const runningTask = this.repo.updateTask(taskId, { status: 'running', completedAt: undefined });
    this.broadcaster.broadcast('task.updated', { taskId, task: runningTask }, taskId);

    try {
      for await (const event of this.adapter.sendMessage(taskId, content)) {
        if (event.type === 'result') {
          this.handleAgentResult(taskId, event.data.message);
        } else if (event.type === 'error') {
          this.handleAgentError(taskId, event.data.message);
        }
      }
    } catch (err) {
      this.handleAgentError(taskId, `执行失败: ${(err as Error).message || '执行出错'}`);
    }
  }

  cancelTask(taskId: string): void {
    this.adapter.cancel(taskId);
  }
}
