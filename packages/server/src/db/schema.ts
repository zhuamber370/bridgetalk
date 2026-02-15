import Database from 'better-sqlite3';

export function initDatabase(dbPath = 'agent_channel_v2.db'): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      model TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL DEFAULT 'main',
      title TEXT NOT NULL,
      title_locked INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_task ON messages(task_id, timestamp);
  `);

  // Migration: add model column for existing DBs
  try {
    db.exec('ALTER TABLE agents ADD COLUMN model TEXT');
  } catch {
    // column already exists, ignore
  }

  // Seed default agent if not exists
  const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get('main');
  if (!existing) {
    const now = Date.now();
    db.prepare('INSERT INTO agents (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('main', '默认 Agent', '系统默认的通用 Agent', now, now);
  }

  return db;
}
