import { VALID_TRANSITIONS, generateId, nowMs } from '@openclaw/shared';
import type { Task, TaskStatus, CreateTaskRequest } from '@openclaw/shared';
import { Repository } from '../db/repository.js';
import { IntentRouter } from './intent-router.js';

export class TaskManager {
  private intentRouter: IntentRouter;

  constructor(private repo: Repository) {
    this.intentRouter = new IntentRouter();
  }

  createTask(req: CreateTaskRequest): Task {
    const now = nowMs();
    const intent = this.intentRouter.scoreIntent(req.content);

    const task: Task = {
      id: generateId(),
      title: this.generateTitle(req.content),
      content: req.content,
      status: 'pending',
      priority: 1,
      createdAt: now,
      updatedAt: now,
      adapterId: 'mock',
      confidence: intent.confidence,
      intent: intent.intent,
      messageIds: [],
      metadata: {
        source: req.context?.source || 'user',
        tags: [],
        isPinned: false,
      },
    };

    return this.repo.createTask(task);
  }

  getTask(id: string): Task | null {
    return this.repo.getTask(id);
  }

  listTasks(options: { status?: string; limit?: number; offset?: number } = {}) {
    const statusArr = options.status?.split(',').filter(Boolean);
    return this.repo.listTasks({
      status: statusArr,
      limit: options.limit,
      offset: options.offset,
    });
  }

  transitionStatus(taskId: string, newStatus: TaskStatus): Task | null {
    const task = this.repo.getTask(taskId);
    if (!task) return null;

    const allowed = VALID_TRANSITIONS[task.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid transition: ${task.status} → ${newStatus}`);
    }

    const patches: Partial<Task> = { status: newStatus };
    if (newStatus === 'completed' || newStatus === 'failed') {
      patches.completedAt = nowMs();
    }

    return this.repo.updateTask(taskId, patches);
  }

  cancelTask(taskId: string): Task | null {
    return this.transitionStatus(taskId, 'cancelled');
  }

  retryTask(taskId: string): Task | null {
    const task = this.repo.getTask(taskId);
    if (!task || task.status !== 'failed') return null;
    return this.repo.updateTask(taskId, { status: 'pending', completedAt: undefined });
  }

  deleteTask(taskId: string): void {
    this.repo.deleteTask(taskId);
  }

  getActiveTask(): Task | null {
    const { items } = this.repo.listTasks({ status: ['running', 'pending'], limit: 1 });
    return items[0] || null;
  }

  private generateTitle(content: string): string {
    const cleaned = content.replace(/\s+/g, ' ').trim();
    return cleaned.length > 20 ? cleaned.slice(0, 20) + '...' : cleaned;
  }
}
