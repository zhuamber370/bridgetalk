import type Database from 'better-sqlite3';
import type { Task, Message, TaskStatus } from '@openclaw/shared';
import { nowMs } from '@openclaw/shared';

// ─── Row → Model Converters ───

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    titleLocked: (row.title_locked as number) === 1,
    status: row.status as TaskStatus,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
    completedAt: row.completed_at as number | undefined,
  };
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    senderType: row.sender_type as Message['senderType'],
    content: row.content as string,
    timestamp: row.timestamp as number,
  };
}

// ─── Repository ───

export class Repository {
  constructor(private db: Database.Database) {}

  // ── Tasks ──

  createTask(task: Task): Task {
    this.db.prepare(`
      INSERT INTO tasks (id, title, status, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      task.id, task.title, task.status,
      task.createdAt, task.updatedAt, task.completedAt ?? null,
    );
    return task;
  }

  getTask(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    return row ? rowToTask(row as Record<string, unknown>) : null;
  }

  updateTask(id: string, patches: Partial<Task>): Task | null {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (patches.title !== undefined) { sets.push('title = ?'); values.push(patches.title); }
    if (patches.titleLocked !== undefined) { sets.push('title_locked = ?'); values.push(patches.titleLocked ? 1 : 0); }
    if (patches.status !== undefined) { sets.push('status = ?'); values.push(patches.status); }
    if (patches.completedAt !== undefined) { sets.push('completed_at = ?'); values.push(patches.completedAt); }

    sets.push('updated_at = ?');
    values.push(nowMs());
    values.push(id);

    this.db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.getTask(id);
  }

  deleteTask(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }

  listTasks(options: { status?: string[]; limit?: number } = {}): { items: Task[]; total: number } {
    const { status, limit = 50 } = options;

    let where = '1=1';
    const params: unknown[] = [];

    if (status && status.length > 0) {
      where += ` AND status IN (${status.map(() => '?').join(',')})`;
      params.push(...status);
    }

    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE ${where}`).get(...params) as { count: number }).count;

    params.push(limit);
    const rows = this.db.prepare(`SELECT * FROM tasks WHERE ${where} ORDER BY updated_at DESC LIMIT ?`).all(...params);

    return {
      items: (rows as Record<string, unknown>[]).map(rowToTask),
      total,
    };
  }

  // ── Messages ──

  createMessage(message: Message): Message {
    this.db.prepare(`
      INSERT INTO messages (id, task_id, sender_type, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      message.id, message.taskId, message.senderType,
      message.content, message.timestamp,
    );
    return message;
  }

  listMessages(taskId: string): Message[] {
    const rows = this.db.prepare(
      'SELECT * FROM messages WHERE task_id = ? ORDER BY timestamp ASC',
    ).all(taskId);
    return (rows as Record<string, unknown>[]).map(rowToMessage);
  }
}
