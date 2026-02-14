import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/schema.js';
import { Repository } from './db/repository.js';
import { TaskManager } from './services/task-manager.js';
import { MessageHub } from './services/message-hub.js';
import { EventBroadcaster } from './services/event-broadcaster.js';
import { TaskExecutor } from './services/task-executor.js';
import { MockAdapter } from './adapters/mock-adapter.js';
import { KimiAdapter } from './adapters/kimi-adapter.js';
import { OpenClawAdapter } from './adapters/openclaw-adapter.js';
import type { Adapter } from './adapters/adapter.js';
import { createTaskRoutes } from './routes/tasks.js';
import { createDataRoutes } from './routes/data.js';
import { createAdapterRoutes } from './routes/adapters.js';
import { createEventRoutes } from './routes/events.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Database ───
const db = initDatabase();
const repo = new Repository(db);

// ─── Services ───
const taskManager = new TaskManager(repo);
const messageHub = new MessageHub(repo);
const broadcaster = new EventBroadcaster(repo);
// Adapter 选择优先级: OpenClaw → Kimi（调试用）→ Mock
const adapter: Adapter = process.env.OPENCLAW_GATEWAY_URL
  ? new OpenClawAdapter()
  : process.env.KIMI_API_KEY
    ? new KimiAdapter()
    : new MockAdapter();
console.log(`[adapter] 使用: ${adapter.name}`);
const executor = new TaskExecutor(repo, adapter, broadcaster, messageHub);

// ─── Middleware ───
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── Routes ───
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/v1/tasks', createTaskRoutes(taskManager, messageHub, executor, broadcaster));
app.use('/api/v1', createDataRoutes(repo));
app.use('/api/v1/adapters', createAdapterRoutes());
app.use('/api/v1', createEventRoutes(broadcaster));

// ─── Error Handler ───
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message });
});

export { app, repo, taskManager, messageHub, broadcaster, executor };

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
