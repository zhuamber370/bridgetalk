import Database from 'better-sqlite3';

export function initDatabase(dbPath = 'agent_channel_v2.db'): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL DEFAULT 'main',
      parent_task_id TEXT,
      title TEXT NOT NULL,
      title_locked INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,
      sender_agent_id TEXT,
      message_type TEXT DEFAULT 'chat',
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_task ON messages(task_id, timestamp);
  `);

  // 迁移：为已有数据库增加新字段
  try {
    db.exec('ALTER TABLE messages ADD COLUMN sender_agent_id TEXT');
  } catch {
    // 字段已存在，忽略
  }

  try {
    db.exec("ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'chat'");
  } catch {
    // 字段已存在，忽略
  }

  try {
    db.exec('ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE');
  } catch {
    // 字段已存在，忽略
  }

  return db;
}
