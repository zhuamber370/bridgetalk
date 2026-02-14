import { generateId, nowMs } from '@openclaw/shared';
import type { Task, CreateTaskRequest } from '@openclaw/shared';
import { Repository } from '../db/repository.js';

export class TaskManager {
  constructor(private repo: Repository) {}

  createTask(req: CreateTaskRequest): Task {
    const now = nowMs();

    const task: Task = {
      id: generateId(),
      agentId: req.agentId || 'main',
      title: this.generateTitle(req.content),
      titleLocked: false,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    return this.repo.createTask(task);
  }

  getTask(id: string): Task | null {
    return this.repo.getTask(id);
  }

  listTasks(options: { status?: string; limit?: number; agentId?: string } = {}) {
    const statusArr = options.status?.split(',').filter(Boolean);
    return this.repo.listTasks({
      status: statusArr,
      limit: options.limit,
      agentId: options.agentId,
    });
  }

  cancelTask(taskId: string): Task | null {
    const task = this.repo.getTask(taskId);
    if (!task) return null;
    if (task.status === 'cancelled') return task;
    return this.repo.updateTask(taskId, { status: 'cancelled', completedAt: nowMs() });
  }

  deleteTask(taskId: string): void {
    this.repo.deleteTask(taskId);
  }

  private generateTitle(content: string): string {
    const cleaned = content.replace(/\s+/g, ' ').trim();
    return cleaned.length > 20 ? cleaned.slice(0, 20) + '...' : cleaned;
  }
}
