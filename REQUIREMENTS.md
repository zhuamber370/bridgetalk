# Requirements Specification and Implementation Document

## OpenClaw Agent Inbox Channel

> **Version**: v0.2.0 — Multi-Agent Inbox
> **Date**: 2026-02-15
> **Status**: Implemented

---

## 1. Product Definition and Boundaries

### 1.1 One-line Definition

**A multi-agent task-driven mobile H5 application where users create Agents and delegate tasks to them. Each task is an independent conversation, with all communication transparently passed to OpenClaw Gateway. Agent contexts are completely isolated.**

### 1.2 Core Design Principles

- **Inbox Mode**: Tasks are first-class citizens; conversations serve tasks (not traditional chat interface)
- **Transparent Channel**: No intent recognition, no tool whitelisting; user messages are directly passed to Gateway
- **Multi-Agent Isolation**: Each Agent has an independent Gateway session with no interference
- **Local Storage**: Server-side SQLite storage with zero cloud sync

### 1.3 Product Boundaries

| Boundary Dimension | In Scope | Out of Scope |
|----------|--------|--------|
| **Format** | Mobile H5 (PWA-ready) | Native apps, desktop clients |
| **Interaction** | Single user × multiple Agent task conversations | Group chat, multi-user collaboration |
| **Storage** | Server-side SQLite, local execution | Cloud sync, multi-device sync |
| **Execution** | Online execution (requires OpenClaw Gateway) | Offline execution, local models |
| **Backend** | OpenClaw Gateway (WebSocket v3) | Self-hosted Agent clusters |
| **Agent** | Users can create multiple Agents, each with independent session | Agent orchestration, workflows |
| **Message** | Plain text messages | Voice, file attachments, card interactions |

---

## 2. Information Architecture

### 2.1 Three-page Navigation

```
AgentListPage → AgentInboxPage → TaskDetailPage
    /             /agents/:agentId    /agents/:agentId/tasks/:taskId
```

#### Page 1: Agent List (`/`)

```
┌─────────────────────────────┐
│  OpenClaw Agents            │
├─────────────────────────────┤
│ ┌──────────┐ ┌──────────┐  │
│ │ A General│ │ T Travel │  │  ← Agent card grid (2 columns)
│ │ Default  │ │ Helper   │  │
│ │ model-id │ │ model-id │  │
│ │ 3 tasks  │ │ 1 task   │  │
│ └──────────┘ └──────────┘  │
│ ┌ ─ ─ ─ ─ ─┐               │
│ │  + Create │               │  ← Dashed box create button
│ │   Agent   │               │
│ └ ─ ─ ─ ─ ─┘               │
└─────────────────────────────┘
```

- Agent cards display: initial letter avatar, name, description, model tag, task count
- `main` Agent is marked as "Default"
- New Agent modal: ID (lowercase letters/numbers/hyphens) + name + description + model selection

#### Page 2: Agent Inbox (`/agents/:agentId`)

```
┌─────────────────────────────┐
│ ← Agent Name                │
├─────────────────────────────┤
│ [New task input...]    [Send]│  ← Quick create
├─────────────────────────────┤
│ All | Active | Needs Reply | Done│  ← Filter tabs
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Task title        [Status]│ │
│ │ Last message preview... 2m│ │  ← Task list
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Another task      [Status]│ │
│ │ Agent reply preview... 1h │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

- Input box creates tasks (one step, no confirmation)
- Filter tabs: All / Active(`running`) / Needs Reply(`waiting`) / Done(`completed`)
- Task sorting: Status priority (running > waiting > pending > completed > failed > cancelled), then by updated time descending
- Click task → enter conversation details
- Swipe left to delete task

#### Page 3: Task Details (`/agents/:agentId/tasks/:taskId`)

```
┌─────────────────────────────┐
│ ← Task title (click to edit) [Status]│
├─────────────────────────────┤
│                             │
│        User message ┐       │  ← Right-aligned blue
│                │ 12:34      │
│                             │
│ ┌ Agent reply               │  ← Left-aligned gray
│ │ 12:35                     │
│                             │
├─────────────────────────────┤
│ [Continue chat...]    [Send]│
└─────────────────────────────┘
```

- Title is clickable to edit (Enter to save, Esc to cancel)
- Message bubbles: User (right-aligned blue), Agent (left-aligned gray)
- Optimistic update: User messages display immediately after sending
- Enter to send, Shift+Enter for new line

---

## 3. Data Models

### 3.1 Two Tables, Three Entities

Database file: `data/agent_channel_v2.db` (SQLite + WAL mode)

> **Note**: Agents are not stored in the database; `~/.openclaw/openclaw.json` is the single source of truth. DB only has `tasks` and `messages` tables.

#### Agent — Stored in openclaw.json

```typescript
interface Agent {
  id: string;          // User-defined, e.g., 'main', 'travel' (lowercase letters/numbers/hyphens)
  name: string;        // Display name
  model?: string;      // Bound model ID (e.g., 'openai-codex/gpt-5.3-codex')
  createdAt: number;   // Timestamp ms (dynamically generated when returned by API)
  updatedAt: number;
}
```

- **Single Source**: `~/.openclaw/openclaw.json` is the only storage location for Agent configuration, not written to DB
- **System Default**: `main` as the default general assistant
- **ID Validation**: `/^[a-z0-9][a-z0-9-]*$/`

#### Task

```typescript
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting' | 'cancelled';

interface Task {
  id: string;          // ULID
  agentId: string;     // Associated Agent (immutable)
  title: string;       // Auto-extracted from user's first message (first 20 chars)
  titleLocked: boolean; // Locked after user manually edits title
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
```

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL DEFAULT 'main',
  title TEXT NOT NULL,
  title_locked INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX idx_tasks_updated ON tasks(updated_at DESC);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_agent ON tasks(agent_id, updated_at DESC);
```

#### Message

```typescript
interface Message {
  id: string;            // ULID
  taskId: string;        // Belongs to task
  senderType: 'user' | 'agent';
  content: string;       // Plain text
  timestamp: number;     // ms
}
```

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
CREATE INDEX idx_messages_task ON messages(task_id, timestamp);
```

### 3.2 State Transitions

```
pending ──→ running ──→ completed
  │            │  ↑         │
  │            │  └─────────┘  (user appends message → resume execution)
  │            ├──→ failed
  │            │       │
  │            │       └──→ running  (retry)
  │            ├──→ waiting
  │            │       │
  │            │       └──→ running / cancelled
  └──→ cancelled
```

Valid transition table:
```typescript
const VALID_TRANSITIONS = {
  pending:   ['running', 'cancelled'],
  running:   ['completed', 'failed', 'waiting', 'cancelled'],
  completed: ['running'],        // Append message
  failed:    ['running'],        // Retry
  waiting:   ['running', 'cancelled'],
  cancelled: [],                 // Final state
};
```

---

## 4. System Architecture

### 4.1 Three-tier Architecture

```
┌─────────────────────────────────────────────────┐
│           Client (React + Tailwind H5)          │
│  Page rendering · State management · SSE/polling · Optimistic updates     │
└──────────────────┬──────────────────────────────┘
                   │ HTTP REST + SSE
┌──────────────────▼──────────────────────────────┐
│        Task Inbox Engine (Express + SQLite)      │
│  Task management · Message persistence · SSE broadcasting · Async execution engine  │
└──────────────────┬──────────────────────────────┘
                   │ WebSocket (Protocol v3)
┌──────────────────▼──────────────────────────────┐
│            OpenClaw Gateway Adapter              │
│  Auth handshake · chat.send · chat.abort · Streaming reception    │
└─────────────────────────────────────────────────┘
```

### 4.2 Monorepo Structure

```
agent-inbox-channel/
├── packages/
│   ├── shared/          # Shared TypeScript types + ULID utilities
│   ├── server/          # Express backend (port 3001)
│   └── client/          # React frontend (Vite, port 5173)
├── data/                # SQLite database files
├── .env                 # Gateway connection config
├── pnpm-workspace.yaml
└── package.json         # pnpm dev starts both in parallel
```

### 4.3 Tech Stack

| Layer | Technology |
|----|------|
| **Frontend Framework** | React 18 + TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Routing** | react-router-dom 7 |
| **Build** | Vite |
| **State Management** | useReducer (Redux-like) |
| **Backend Framework** | Express 4 |
| **Database** | better-sqlite3 (WAL mode) |
| **WebSocket** | ws |
| **ID Generation** | ULID |
| **PWA** | vite-plugin-pwa (configured, ready to activate) |

---

## 5. API Specification

### 5.1 Agent API

| Method | Endpoint | Description | Request | Response |
|------|------|------|------|------|
| POST | `/api/v1/agents` | Create Agent | `{id, name, model?}` | `201 Agent` |
| GET | `/api/v1/agents` | List Agents | — | `Agent[]` |
| GET | `/api/v1/agents/:id` | Get Agent | — | `Agent` |

> Note: No PATCH / DELETE endpoints. Agents cannot be modified or deleted via API once created.

**Create Agent Side Effects**:
1. Check if Agent with same ID already exists in `openclaw.json`
2. Register to `~/.openclaw/openclaw.json` (agents.list + allowAgents + agentToAgent.allow)
3. Create workspace and agent directories

**List Agents Logic**:
1. Read directly from `openclaw.json` main + `allowAgents` whitelist
2. Convert to `Agent` objects and return (bypassing DB)

### 5.2 Task API

| Method | Endpoint | Description | Request | Response |
|------|------|------|------|------|
| POST | `/api/v1/tasks` | Create task and execute | `{content, agentId?}` | `201 Task` |
| GET | `/api/v1/tasks` | List tasks | `?agentId=&status=&limit=50` | `Task[]` |
| GET | `/api/v1/tasks/:id` | Get task | — | `Task` |
| PATCH | `/api/v1/tasks/:id` | Update task | `{title?}` | `Task` |
| POST | `/api/v1/tasks/:id/cancel` | Cancel task | — | `Task` |
| DELETE | `/api/v1/tasks/:id` | Delete task | — | `204` |

**Create Task Flow**:
```
POST {content, agentId} →
  1. TaskManager.createTask()          — Generate Task (title=first 20 chars)
  2. Repository.createMessage()         — Save user message
  3. EventBroadcaster.broadcast()       — SSE broadcast task.created + message.created
  4. TaskExecutor.executeTask()          — Async start execution (non-blocking response)
  5. Return 201 Task
```

### 5.3 Message API

| Method | Endpoint | Description | Request | Response |
|------|------|------|------|------|
| POST | `/api/v1/tasks/:id/messages` | Send message | `{content}` | `{ok: true}` |
| GET | `/api/v1/tasks/:id/messages` | Message history | — | `Message[]` |

**Note**: `sendMessage` returns `{ok: true}` not Message. Message is saved then asynchronously forwarded to Gateway; Agent replies are pushed via SSE.

### 5.4 SSE Events

| Endpoint | Description |
|------|------|
| GET `/api/v1/events` | Global event stream |
| GET `/api/v1/tasks/:id/events` | Single task event stream |

**Event Types**:

| Event Name | Data | Description |
|--------|------|------|
| `task.created` | Complete Task object | New task created |
| `task.updated` | Complete Task object | Task status changed |
| `message.created` | Complete Message object | New message (user or Agent) |
| `heartbeat` | `{timestamp}` | 30-second keep-alive |

**Real-time Guarantees**: SSE + frontend polling dual mechanism
- AgentInboxPage: Poll task list every 5 seconds
- TaskDetailPage: Poll messages + task status every 3 seconds

### 5.5 Other Endpoints

| Method | Endpoint | Description |
|------|------|------|
| GET | `/health` | Health check `{status: 'ok', timestamp}` |
| GET | `/api/v1/openclaw/models` | List available AI models |

---

## 6. OpenClaw Gateway Adapter

### 6.1 Connection Method

Uses **WebSocket Protocol v3** (not HTTP), connecting with `operator` role.

```
Environment variables:
  OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
  OPENCLAW_GATEWAY_TOKEN=<auth-token>
  OPENCLAW_GATEWAY_TIMEOUT=300000  (default 5 minutes)
```

### 6.2 Authentication Handshake

```
1. WebSocket connection established
2. Gateway sends event: connect.challenge
3. Client sends connect request:
   {
     type: 'req', method: 'connect',
     params: {
       minProtocol: 3, maxProtocol: 3,
       role: 'operator',
       scopes: ['operator.read', 'operator.write'],
       auth: { token: '<gateway-token>' }
     }
   }
4. Gateway responds { ok: true } → authentication complete
```

### 6.3 Communication Methods

| Method | Purpose | Parameters |
|------|------|------|
| `chat.send` | Send message to Agent | `{sessionKey, message, idempotencyKey}` |
| `chat.abort` | Abort execution | `{sessionKey}` |

**sessionKey Format**: `agent:{agentId}:main`

> **Critical Trap**: Gateway converts sessionKey to lowercase. If ID contains uppercase characters (like ULID), must `.toLowerCase()` first.

### 6.4 Streaming Reception

Gateway pushes chat events via WebSocket event frames:

```typescript
interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;       // Message content (text or structured)
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}
```

- `delta`: Streaming intermediate results, accumulate text
- `final`: Final complete reply → create agent Message + update task to completed
- `error`: Execution error → create error Message + update task to failed
- `aborted`: Aborted

### 6.5 Reconnection Strategy

- Maximum 10 retries
- Exponential backoff: 1s → 2s → 4s → ... → max 30s
- Auto-reject all pending requests on connection drop

### 6.6 Transparent Channel Design

Adapter **does NOT** do the following (important difference from old requirements):
- ❌ Intent recognition / confidence calculation
- ❌ Tool whitelist filtering
- ❌ Dangerous command detection / secondary confirmation
- ❌ Prompt concatenation / system instruction injection
- ❌ Parameter transformation / result formatting

User messages are **passed as-is** to Gateway; Gateway has full authority on how to handle them.

---

## 7. Agent Management

### 7.1 Single Source Principle

The only storage location for Agent configuration is `~/.openclaw/openclaw.json`, **not written to database**.

```
openclaw.json (allowAgents) ──→ GET /api/v1/agents ──→ Frontend display
```

- Only shows Agents in whitelist (main itself + IDs listed in allowAgents)
- Agent API directly reads/writes openclaw.json, bypassing DB

### 7.2 Create Agent

When creating Agent via UI:
1. Validate ID format (`/^[a-z0-9][a-z0-9-]*$/`)
2. Check if same ID already exists in `openclaw.json`
3. Call `registerAgent()` to register to `openclaw.json`:
   - Add to `agents.list` (including workspace, agentDir, model)
   - Add to `tools.agentToAgent.allow`
   - Add to main agent's `subagents.allowAgents`
4. Create directories: `workspace-{id}/`, `agents/{id}/agent/`, `agents/{id}/sessions/`

### 7.3 Modification and Deletion Not Supported

UI does not provide functionality to modify or delete Agents.
- Design principle: "Can create appropriately, but don't modify or delete things that exist in OpenClaw itself"

---

## 8. Frontend Implementation Details

### 8.1 State Management

Uses React `useReducer` to implement Redux-like store:

```typescript
interface AppState {
  agents: Agent[];
  tasks: Task[];
  messagesByTask: Record<string, Message[]>;
}

// Actions
| SET_AGENTS / ADD_AGENT / REMOVE_AGENT
| SET_TASKS / ADD_TASK / UPDATE_TASK / REMOVE_TASK
| SET_MESSAGES / ADD_MESSAGE
```

- `ADD_*` auto-deduplicates (by id)
- `ADD_TASK` prepends to list head (newest first)
- `ADD_MESSAGE` grouped storage by taskId

### 8.2 SSE Client

Global SSE connection `/api/v1/events`, initialized in App root component:

```typescript
// SSEConnector component
onEvent('task.created', (data) => dispatch({ type: 'ADD_TASK', task: data }))
onEvent('task.updated', (data) => dispatch({ type: 'UPDATE_TASK', task: data }))
onEvent('message.created', (data) => dispatch({ type: 'ADD_MESSAGE', message: data }))
```

Auto-reconnect: Retry 3 seconds after disconnect.

### 8.3 Optimistic Update

Display user message immediately in UI when sending (don't wait for SSE push):

```typescript
const optimisticMsg: Message = {
  id: `tmp_${Date.now()}`,    // Temporary ID
  taskId: id,
  senderType: 'user',
  content: text,
  timestamp: Date.now(),
};
dispatch({ type: 'ADD_MESSAGE', message: optimisticMsg });
await sendMessage(id, text);  // Async send, non-blocking UI
```

### 8.4 Polling Fallback

SSE is unstable in certain network environments; frontend adds polling as fallback:

| Page | Polling Interval | Polling Content |
|------|----------|----------|
| AgentInboxPage | 5 seconds | Task list |
| TaskDetailPage | 3 seconds | Task status + message list |

### 8.5 UI Components

| Component | File | Description |
|------|------|------|
| AgentCard | `components/AgentCard.tsx` | Agent card (avatar, name, description, model, task count) |
| TaskItem | `components/TaskItem.tsx` | Task list item (title, last message preview, status, time) |
| MessageBubble | `components/MessageBubble.tsx` | Message bubble (user blue right-aligned, Agent gray left-aligned) |
| TaskStatusBadge | `components/TaskStatusBadge.tsx` | Status badge (6 statuses each with color) |
| ErrorBoundary | `components/ErrorBoundary.tsx` | Global error capture |

---

## 9. Server Modules

### 9.1 Database Initialization (db/schema.ts)

- Create `tasks`, `messages` tables
- WAL mode + foreign key constraints
- Agents not stored in DB (managed by openclaw.json)

### 9.2 Repository (db/repository.ts)

| Method | Description |
|------|------|
| `createTask / getTask / listTasks / updateTask / deleteTask` | Task CRUD |
| `createMessage / listMessages` | Message read/write |

> Note: No Agent-related methods. Agent read/write handled by `openclaw-config.ts` directly operating openclaw.json.

### 9.3 Task Manager (services/task-manager.ts)

- `createTask(req)`: Generate ULID, truncate title to 20 chars, default agentId='main'
- `listTasks(options)`: Support status/agentId/limit filtering
- `cancelTask(id)`: Mark as cancelled
- State transition validation

### 9.4 Task Executor (services/task-executor.ts)

Async execution engine handling two scenarios:

| Method | Scenario | Flow |
|------|------|------|
| `executeTask(taskId, content)` | New task first execution | pending → running → adapter.execute() → completed/failed |
| `sendMessage(taskId, content)` | Append message to existing task | Save message → running → adapter.sendMessage() → completed/failed |

Each `ExecutionEvent` (result/error) will:
1. Create agent Message and write to DB
2. Broadcast `message.created` via SSE
3. Update task status and broadcast `task.updated`

### 9.5 Event Broadcaster (services/event-broadcaster.ts)

- Manage all SSE client connections
- `broadcast(eventType, data, taskId?)`: Broadcast to global or specific task's clients
- 30-second heartbeat keep-alive
- Auto-cleanup disconnected connections

### 9.6 OpenClaw Config Management (services/openclaw-config.ts)

| Function | Description |
|------|------|
| `listConfiguredAgents()` | Read main + allowAgents whitelist from openclaw.json |
| `listAvailableModels()` | Read model list from `agents.defaults.models` |
| `registerAgent(id, name, model?)` | Register new agent to openclaw.json + create directories |

---

## 10. Core Data Flows

### 10.1 Create Task

```
User inputs "Help me track package"
     │
     ▼
POST /api/v1/tasks {content: "Help me track package", agentId: "main"}
     │
     ▼
TaskManager.createTask()
  → Task {id: "01J...", title: "Help me track package", status: "pending"}
     │
     ▼
Repository.createMessage()
  → Message {senderType: "user", content: "Help me track package"}
     │
     ▼
SSE broadcast task.created + message.created
     │
     ▼
TaskExecutor.executeTask()     ← Async, non-blocking HTTP response
  → Task.status = "running"
  → SSE broadcast task.updated
     │
     ▼
OpenClawAdapter.execute()
  → chat.send {sessionKey: "agent:main:main", message: "Help me track package"}
     │
     ▼
Gateway processes → streams chat events
  delta → delta → delta → final
     │
     ▼
final → create agent Message → SSE broadcast message.created
     → Task.status = "completed" → SSE broadcast task.updated
```

### 10.2 Append Message

```
User inputs in existing task "Can't find it, try another way"
     │
     ▼
POST /api/v1/tasks/:id/messages {content: "..."}
     │
     ▼
Create user Message → SSE broadcast message.created
     │
     ▼
TaskExecutor.sendMessage()
  → Task.status = "running"
  → adapter.sendMessage(task, content)  ← Same sessionKey, continue context
  → Gateway replies → agent Message → completed
```

---

## 11. Configuration

### 11.1 Environment Variables (.env)

```bash
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789   # Gateway WebSocket address
OPENCLAW_GATEWAY_TOKEN=<token>                # Auth token
OPENCLAW_GATEWAY_TIMEOUT=300000               # Timeout ms (default 5 minutes)
PORT=3001                                     # Server listening port
```

### 11.2 Vite Development Proxy

```typescript
// vite.config.ts
proxy: {
  '/api': { target: 'http://localhost:3001' },
  '/health': { target: 'http://localhost:3001' },
}
```

---

## 12. Implemented vs Not Implemented

### 12.1 Implemented (v0.2.0)

| Module | Features |
|------|------|
| **Multi-Agent** | Agent creation, listing, model binding, openclaw.json sync |
| **Task Management** | Create, list, filter, delete, cancel |
| **Messages** | Send, view history, optimistic updates |
| **Real-time Communication** | SSE event stream + polling fallback |
| **Execution Engine** | Async execution, state transitions, Gateway passthrough |
| **Gateway Integration** | WebSocket v3 complete implementation (auth, chat, abort, reconnect) |
| **Agent Isolation** | Each Agent with independent sessionKey, contexts don't interfere |
| **Title Editing** | Task titles clickable to edit |
| **Status Display** | 6 status types with colored badges |
| **PWA Config** | vite-plugin-pwa integrated |

### 12.2 Not Implemented (Planned)

| Feature | Description |
|------|------|
| Data Export/Import | JSON format export, import, wipe |
| Browser Push Notifications | System-level notifications on task completion |
| PWA Offline Cache | Service Worker offline support |
| Markdown Rendering | Formatted display of Agent replies in Markdown |
| Search | Full-text search of tasks and messages |
| Auto Task Categorization | AI auto-tags/categorizes tasks |
| Quick Action Buttons | Interactive buttons embedded in Agent messages |
| Agent Orchestration | Main Agent dispatches sub-Agents for task execution |

---

## 13. Critical Traps and Notes

| Trap | Description |
|------|------|
| **sessionKey Case** | Gateway converts sessionKey to lowercase; must `.toLowerCase()` when building |
| **listTasks Return Format** | API returns `Task[]` (direct array), not `{items, total}` |
| **sendMessage Return** | Returns `{ok: true}`, not Message object; messages pushed via SSE asynchronously |
| **Creation Order** | When creating task, must create user Message first before execution, otherwise adapter can't get history |
| **task.updated Event** | SSE event must carry complete Task object (frontend uses for full replacement) |
| **DB Filename** | v0.2.0 uses `agent_channel_v2.db` (different from v0.1.0's `agent_communication.db`) |
| **Default agentId** | Defaults to `'main'` when not specified |
| **Vite SSE Proxy** | Need to disable buffering in proxy config, otherwise SSE events are batched |

---

## 14. Development Commands

```bash
# Install dependencies
pnpm install

# Start development (frontend and backend in parallel)
pnpm dev

# Start individually
pnpm --filter @openclaw/server dev    # Backend :3001
pnpm --filter @openclaw/client dev    # Frontend :5173

# Build
pnpm build

# Lint
pnpm lint
```

---

## 15. Version History

| Version | Date | Milestone |
|------|------|--------|
| v0.1.0 | 2026-02-09 | Inbox mode rewrite + task-driven + Gateway passthrough |
| v0.1.1 | 2026-02-10 | WebSocket native protocol (replaced HTTP+SSE) |
| v0.2.0 | 2026-02-14 | Multi-Agent architecture + model binding + openclaw.json sync |

---

*Documentation synchronized with code | Code is source of truth*
