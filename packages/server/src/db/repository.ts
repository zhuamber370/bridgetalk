import type Database from 'better-sqlite3';
import type {
  Task, Message, Update, Artifact, SSEEvent,
  TaskStatus, TaskMetadata,
} from '@openclaw/shared';

// ─── Row ↔ Model Converters ───

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    status: row.status as TaskStatus,
    priority: row.priority as 0 | 1 | 2,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
    dueDate: row.due_date as number | undefined,
    completedAt: row.completed_at as number | undefined,
    adapterId: row.adapter_id as string,
    confidence: row.confidence as number,
    intent: row.intent as string,
    messageIds: JSON.parse((row.message_ids as string) || '[]'),
    metadata: JSON.parse((row.metadata as string) || '{}') as TaskMetadata,
    deletedAt: row.deleted_at as number | undefined,
  };
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    sender: {
      type: row.sender_type as 'user' | 'agent' | 'system',
      id: row.sender_id as string,
      name: row.sender_name as string | undefined,
    },
    content: row.content as string,
    contentType: row.content_type as Message['contentType'],
    cardData: row.card_data ? JSON.parse(row.card_data as string) : undefined,
    status: row.status as Message['status'],
    timestamp: row.timestamp as number,
    replyTo: row.reply_to as string | undefined,
    actions: row.actions ? JSON.parse(row.actions as string) : undefined,
  };
}

function rowToUpdate(row: Record<string, unknown>): Update {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    messageId: row.message_id as string,
    type: row.type as Update['type'],
    title: row.title as string,
    content: row.content as string,
    payload: row.payload ? JSON.parse(row.payload as string) : undefined,
    attachments: row.attachments ? JSON.parse(row.attachments as string) : undefined,
    createdAt: row.created_at as number,
  };
}

function rowToArtifact(row: Record<string, unknown>): Artifact {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    updateId: row.update_id as string | undefined,
    name: row.name as string,
    mimeType: row.mime_type as string,
    size: row.size as number,
    data: row.data as string | undefined,
    storagePath: row.storage_path as string | undefined,
    createdAt: row.created_at as number,
    checksum: row.checksum as string,
  };
}

function rowToSSEEvent(row: Record<string, unknown>): SSEEvent {
  return {
    id: row.id as string,
    event: row.event as SSEEvent['event'],
    data: JSON.parse(row.data as string),
    timestamp: row.timestamp as number,
    taskId: row.task_id as string | undefined,
  };
}

// ─── Repository ───

export class Repository {
  constructor(private db: Database.Database) {}

  // ── Tasks ──

  createTask(task: Task): Task {
    this.db.prepare(`
      INSERT INTO tasks (id, title, content, status, priority, created_at, updated_at, due_date, completed_at, adapter_id, confidence, intent, message_ids, metadata, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id, task.title, task.content, task.status, task.priority,
      task.createdAt, task.updatedAt, task.dueDate ?? null, task.completedAt ?? null,
      task.adapterId, task.confidence, task.intent,
      JSON.stringify(task.messageIds), JSON.stringify(task.metadata),
      task.deletedAt ?? null,
    );
    return task;
  }

  getTask(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id);
    return row ? rowToTask(row as Record<string, unknown>) : null;
  }

  updateTask(id: string, patches: Partial<Task>): Task | null {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (patches.title !== undefined) { sets.push('title = ?'); values.push(patches.title); }
    if (patches.status !== undefined) { sets.push('status = ?'); values.push(patches.status); }
    if (patches.priority !== undefined) { sets.push('priority = ?'); values.push(patches.priority); }
    if (patches.completedAt !== undefined) { sets.push('completed_at = ?'); values.push(patches.completedAt); }
    if (patches.adapterId !== undefined) { sets.push('adapter_id = ?'); values.push(patches.adapterId); }
    if (patches.confidence !== undefined) { sets.push('confidence = ?'); values.push(patches.confidence); }
    if (patches.intent !== undefined) { sets.push('intent = ?'); values.push(patches.intent); }
    if (patches.messageIds !== undefined) { sets.push('message_ids = ?'); values.push(JSON.stringify(patches.messageIds)); }
    if (patches.metadata !== undefined) { sets.push('metadata = ?'); values.push(JSON.stringify(patches.metadata)); }
    if (patches.deletedAt !== undefined) { sets.push('deleted_at = ?'); values.push(patches.deletedAt); }

    sets.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    this.db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.getTask(id);
  }

  deleteTask(id: string): void {
    this.updateTask(id, { deletedAt: Date.now() });
  }

  listTasks(options: { status?: string[]; limit?: number; offset?: number } = {}): { items: Task[]; total: number } {
    const { status, limit = 50, offset = 0 } = options;

    let where = 'deleted_at IS NULL';
    const params: unknown[] = [];

    if (status && status.length > 0) {
      where += ` AND status IN (${status.map(() => '?').join(',')})`;
      params.push(...status);
    }

    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE ${where}`).get(...params) as { count: number }).count;

    params.push(limit, offset);
    const rows = this.db.prepare(`SELECT * FROM tasks WHERE ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...params);

    return {
      items: (rows as Record<string, unknown>[]).map(rowToTask),
      total,
    };
  }

  // ── Messages ──

  createMessage(message: Message): Message {
    this.db.prepare(`
      INSERT INTO messages (id, task_id, sender_type, sender_id, sender_name, content, content_type, card_data, status, timestamp, reply_to, actions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.id, message.taskId,
      message.sender.type, message.sender.id, message.sender.name ?? null,
      message.content, message.contentType,
      message.cardData ? JSON.stringify(message.cardData) : null,
      message.status, message.timestamp,
      message.replyTo ?? null,
      message.actions ? JSON.stringify(message.actions) : null,
    );
    return message;
  }

  listMessages(taskId: string, options: { limit?: number; offset?: number } = {}): Message[] {
    const { limit = 50, offset = 0 } = options;
    const rows = this.db.prepare(
      'SELECT * FROM messages WHERE task_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?',
    ).all(taskId, limit, offset);
    return (rows as Record<string, unknown>[]).map(rowToMessage);
  }

  // ── Updates ──

  createUpdate(update: Update): Update {
    this.db.prepare(`
      INSERT INTO updates (id, task_id, message_id, type, title, content, payload, attachments, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      update.id, update.taskId, update.messageId, update.type,
      update.title, update.content,
      update.payload ? JSON.stringify(update.payload) : null,
      update.attachments ? JSON.stringify(update.attachments) : null,
      update.createdAt,
    );
    return update;
  }

  listUpdates(taskId: string): Update[] {
    const rows = this.db.prepare('SELECT * FROM updates WHERE task_id = ? ORDER BY created_at ASC').all(taskId);
    return (rows as Record<string, unknown>[]).map(rowToUpdate);
  }

  // ── Artifacts ──

  createArtifact(artifact: Artifact): Artifact {
    this.db.prepare(`
      INSERT INTO artifacts (id, task_id, update_id, name, mime_type, size, data, storage_path, created_at, checksum)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      artifact.id, artifact.taskId, artifact.updateId ?? null,
      artifact.name, artifact.mimeType, artifact.size,
      artifact.data ?? null, artifact.storagePath ?? null,
      artifact.createdAt, artifact.checksum,
    );
    return artifact;
  }

  getArtifact(id: string): Artifact | null {
    const row = this.db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id);
    return row ? rowToArtifact(row as Record<string, unknown>) : null;
  }

  listArtifacts(taskId: string): Artifact[] {
    const rows = this.db.prepare('SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at ASC').all(taskId);
    return (rows as Record<string, unknown>[]).map(rowToArtifact);
  }

  // ── SSE Events ──

  createSSEEvent(event: SSEEvent): SSEEvent {
    this.db.prepare(`
      INSERT INTO sse_events (id, event, data, timestamp, task_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(event.id, event.event, JSON.stringify(event.data), event.timestamp, event.taskId ?? null);
    return event;
  }

  getSSEEventsAfter(eventId: string, taskId?: string): SSEEvent[] {
    const refEvent = this.db.prepare('SELECT timestamp FROM sse_events WHERE id = ?').get(eventId) as { timestamp: number } | undefined;
    if (!refEvent) return [];

    let sql = 'SELECT * FROM sse_events WHERE timestamp > ?';
    const params: unknown[] = [refEvent.timestamp];

    if (taskId) {
      sql += ' AND (task_id = ? OR task_id IS NULL)';
      params.push(taskId);
    }

    sql += ' ORDER BY timestamp ASC';
    const rows = this.db.prepare(sql).all(...params);
    return (rows as Record<string, unknown>[]).map(rowToSSEEvent);
  }

  cleanupOldSSEEvents(maxAgeMs = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    const result = this.db.prepare('DELETE FROM sse_events WHERE timestamp < ?').run(cutoff);
    return result.changes;
  }

  // ── Bulk Operations ──

  getAllTasks(): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all();
    return (rows as Record<string, unknown>[]).map(rowToTask);
  }

  getAllMessages(): Message[] {
    const rows = this.db.prepare('SELECT * FROM messages ORDER BY timestamp ASC').all();
    return (rows as Record<string, unknown>[]).map(rowToMessage);
  }

  getAllUpdates(): Update[] {
    const rows = this.db.prepare('SELECT * FROM updates ORDER BY created_at ASC').all();
    return (rows as Record<string, unknown>[]).map(rowToUpdate);
  }

  getAllArtifacts(): Artifact[] {
    const rows = this.db.prepare('SELECT * FROM artifacts ORDER BY created_at ASC').all();
    return (rows as Record<string, unknown>[]).map(rowToArtifact);
  }

  wipeAll(): void {
    this.db.exec(`
      DELETE FROM artifacts;
      DELETE FROM updates;
      DELETE FROM messages;
      DELETE FROM sse_events;
      DELETE FROM tasks;
    `);
  }
}
