import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 从项目根目录加载 .env（packages/server/src/ → 上三级）
dotenv.config({ path: resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/schema.js';
import { Repository } from './db/repository.js';
import { TaskManager } from './services/task-manager.js';
import { EventBroadcaster } from './services/event-broadcaster.js';
import { TaskExecutor } from './services/task-executor.js';
import { OpenClawAdapter } from './adapters/openclaw-adapter.js';
import { createTaskRoutes } from './routes/tasks.js';
import { createAgentRoutes } from './routes/agents.js';
import { createEventRoutes } from './routes/events.js';
import { createOpenClawRoutes } from './routes/openclaw.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Database ───
const db = initDatabase();
const repo = new Repository(db);

// ─── Services ───
const adapter = new OpenClawAdapter();
console.log(`[adapter] 使用: ${adapter.name}`);
const taskManager = new TaskManager(repo);
const broadcaster = new EventBroadcaster();
const executor = new TaskExecutor(repo, adapter, broadcaster);

// ─── Middleware ───
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── Routes ───
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/v1/agents', createAgentRoutes());
app.use('/api/v1/openclaw', createOpenClawRoutes());
app.use('/api/v1/tasks', createTaskRoutes(taskManager, executor, repo, broadcaster));
app.use('/api/v1', createEventRoutes(broadcaster));

// ─── Error Handler ───
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message });
});

export { app, repo, taskManager, broadcaster, executor };

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
