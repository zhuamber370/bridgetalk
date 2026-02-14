import Database from 'better-sqlite3';

export function initDatabase(dbPath = 'agent_communication.db'): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      due_date INTEGER,
      completed_at INTEGER,
      adapter_id TEXT NOT NULL DEFAULT 'mock',
      confidence REAL NOT NULL DEFAULT 0,
      intent TEXT NOT NULL DEFAULT 'general',
      message_ids TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}',
      deleted_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT,
      content TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'text',
      card_data TEXT,
      status TEXT NOT NULL DEFAULT 'sent',
      timestamp INTEGER NOT NULL,
      reply_to TEXT,
      actions TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_task_id ON messages(task_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

    CREATE TABLE IF NOT EXISTS updates (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      payload TEXT,
      attachments TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_updates_task_id ON updates(task_id);

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      update_id TEXT,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      data TEXT,
      storage_path TEXT,
      created_at INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_artifacts_task_id ON artifacts(task_id);

    CREATE TABLE IF NOT EXISTS sse_events (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      task_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sse_events_timestamp ON sse_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_sse_events_task_id ON sse_events(task_id);
  `);

  return db;
}
