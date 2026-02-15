# 需求规格与实现文档

## OpenClaw Agent Inbox Channel

> **版本**: v0.2.0 — Multi-Agent Inbox
> **日期**: 2026-02-15
> **状态**: 已实现

---

## 1. 产品定义与边界

### 1.1 一句话定义

**一个多 Agent 任务驱动的移动端 H5 应用，用户创建 Agent 并向其委托任务，每个任务是一个独立对话，所有通信透传至 OpenClaw Gateway，Agent 间上下文完全隔离。**

### 1.2 核心设计理念

- **Inbox 模式**：任务是第一公民，对话服务于任务（非传统聊天界面）
- **透明通道**：不做意图识别、不做工具白名单，用户消息直接透传给 Gateway
- **多 Agent 隔离**：每个 Agent 拥有独立的 Gateway session，互不干扰
- **本地存储**：服务端 SQLite 存储，零云端同步

### 1.3 产品边界

| 边界维度 | 范围内 | 范围外 |
|----------|--------|--------|
| **形态** | 移动端 H5（PWA 就绪） | 原生 App、桌面客户端 |
| **交互** | 单用户 × 多 Agent 任务对话 | 群聊、多人协作 |
| **存储** | 服务端 SQLite，本地运行 | 云端同步、多设备同步 |
| **执行** | 在线执行（需 OpenClaw Gateway） | 离线执行、本地模型 |
| **后端** | OpenClaw Gateway（WebSocket v3） | 自建 Agent 集群 |
| **Agent** | 用户可创建多个 Agent，各自独立 session | Agent 间编排、工作流 |
| **消息** | 纯文本消息 | 语音、文件附件、卡片交互 |

---

## 2. 信息架构

### 2.1 三页面导航

```
AgentListPage → AgentInboxPage → TaskDetailPage
    /             /agents/:agentId    /agents/:agentId/tasks/:taskId
```

#### 页面 1：Agent 列表（`/`）

```
┌─────────────────────────────┐
│  OpenClaw Agents            │
├─────────────────────────────┤
│ ┌──────────┐ ┌──────────┐  │
│ │ A 通用助手│ │ T 旅行助手│  │  ← Agent 卡片网格（2列）
│ │ 默认      │ │          │  │
│ │ model-id  │ │ model-id │  │
│ │ 3 个任务  │ │ 1 个任务 │  │
│ └──────────┘ └──────────┘  │
│ ┌ ─ ─ ─ ─ ─┐               │
│ │  + 新建   │               │  ← 虚线框创建按钮
│ │  Agent    │               │
│ └ ─ ─ ─ ─ ─┘               │
└─────────────────────────────┘
```

- Agent 卡片显示：首字母头像、名称、描述、模型标签、任务计数
- `main` Agent 标记为「默认」
- 新建 Agent 弹窗：ID（小写字母/数字/短横线）+ 名称 + 描述 + 模型选择

#### 页面 2：Agent Inbox（`/agents/:agentId`）

```
┌─────────────────────────────┐
│ ← Agent名称                │
├─────────────────────────────┤
│ [输入新任务...]        [发送]│  ← 快速创建
├─────────────────────────────┤
│ 全部 | 进行中 | 需回复 | 完成│  ← 过滤标签
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 任务标题          [状态] │ │
│ │ 最后消息预览...    2分前 │ │  ← 任务列表
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 另一个任务        [状态] │ │
│ │ Agent回复预览...   1小时 │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

- 输入框创建任务（一步完成，无确认）
- 过滤标签：全部 / 进行中(`running`) / 需回复(`waiting`) / 已完成(`completed`)
- 任务排序：状态优先（running > waiting > pending > completed > failed > cancelled），再按更新时间倒序
- 点击任务 → 进入对话详情
- 左滑删除任务

#### 页面 3：任务详情（`/agents/:agentId/tasks/:taskId`）

```
┌─────────────────────────────┐
│ ← 任务标题(可点击编辑) [状态]│
├─────────────────────────────┤
│                             │
│        用户消息 ┐            │  ← 右对齐蓝色
│                │ 12:34      │
│                             │
│ ┌ Agent回复                 │  ← 左对齐灰色
│ │ 12:35                     │
│                             │
├─────────────────────────────┤
│ [继续对话...]          [发送]│
└─────────────────────────────┘
```

- 标题可点击编辑（Enter 保存，Esc 取消）
- 消息气泡：用户（右对齐蓝色）、Agent（左对齐灰色）
- 乐观更新：用户消息发送后立即显示
- Enter 发送，Shift+Enter 换行

---

## 3. 数据模型

### 3.1 两张表、三个实体

数据库文件：`data/agent_channel_v2.db`（SQLite + WAL 模式）

> **注意**：Agent 不存储在数据库中，以 `~/.openclaw/openclaw.json` 为唯一权威来源。DB 只有 `tasks` 和 `messages` 两张表。

#### Agent（智能体）— 存储于 openclaw.json

```typescript
interface Agent {
  id: string;          // 用户定义，如 'main', 'travel'（小写字母/数字/短横线）
  name: string;        // 显示名称
  model?: string;      // 绑定的模型 ID（如 'openai-codex/gpt-5.3-codex'）
  createdAt: number;   // 时间戳 ms（API 返回时动态生成）
  updatedAt: number;
}
```

- **单一来源**：`~/.openclaw/openclaw.json` 是 Agent 配置的唯一存储位置，不写入 DB
- **系统默认**：`main` 作为默认通用助手
- **ID 校验**：`/^[a-z0-9][a-z0-9-]*$/`

#### Task（任务）

```typescript
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting' | 'cancelled';

interface Task {
  id: string;          // ULID
  agentId: string;     // 关联 Agent（不可变）
  title: string;       // 自动截取用户首句前20字
  titleLocked: boolean; // 用户手动改过标题后锁定
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

#### Message（消息）

```typescript
interface Message {
  id: string;            // ULID
  taskId: string;        // 所属任务
  senderType: 'user' | 'agent';
  content: string;       // 纯文本
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

### 3.2 状态流转

```
pending ──→ running ──→ completed
  │            │  ↑         │
  │            │  └─────────┘  (用户追加消息 → 恢复执行)
  │            ├──→ failed
  │            │       │
  │            │       └──→ running  (重试)
  │            ├──→ waiting
  │            │       │
  │            │       └──→ running / cancelled
  └──→ cancelled
```

合法转换表：
```typescript
const VALID_TRANSITIONS = {
  pending:   ['running', 'cancelled'],
  running:   ['completed', 'failed', 'waiting', 'cancelled'],
  completed: ['running'],        // 追加消息
  failed:    ['running'],        // 重试
  waiting:   ['running', 'cancelled'],
  cancelled: [],                 // 终态
};
```

---

## 4. 系统架构

### 4.1 三层架构

```
┌─────────────────────────────────────────────────┐
│           Client (React + Tailwind H5)          │
│  页面渲染 · 状态管理 · SSE/轮询 · 乐观更新     │
└──────────────────┬──────────────────────────────┘
                   │ HTTP REST + SSE
┌──────────────────▼──────────────────────────────┐
│        Task Inbox Engine (Express + SQLite)      │
│  任务管理 · 消息持久化 · SSE广播 · 异步执行引擎  │
└──────────────────┬──────────────────────────────┘
                   │ WebSocket (Protocol v3)
┌──────────────────▼──────────────────────────────┐
│            OpenClaw Gateway Adapter              │
│  认证握手 · chat.send · chat.abort · 流式接收    │
└─────────────────────────────────────────────────┘
```

### 4.2 Monorepo 结构

```
agent-inbox-channel/
├── packages/
│   ├── shared/          # 共享 TypeScript 类型 + ULID 工具
│   ├── server/          # Express 后端（端口 3001）
│   └── client/          # React 前端（Vite，端口 5173）
├── data/                # SQLite 数据库文件
├── .env                 # Gateway 连接配置
├── pnpm-workspace.yaml
└── package.json         # pnpm dev 并行启动
```

### 4.3 技术栈

| 层 | 技术 |
|----|------|
| **前端框架** | React 18 + TypeScript |
| **样式** | Tailwind CSS 4 |
| **路由** | react-router-dom 7 |
| **构建** | Vite |
| **状态管理** | useReducer（Redux-like） |
| **后端框架** | Express 4 |
| **数据库** | better-sqlite3（WAL 模式） |
| **WebSocket** | ws |
| **ID 生成** | ULID |
| **PWA** | vite-plugin-pwa（已配置，待激活） |

---

## 5. API 规格

### 5.1 Agent API

| 方法 | 端点 | 描述 | 请求 | 响应 |
|------|------|------|------|------|
| POST | `/api/v1/agents` | 创建 Agent | `{id, name, model?}` | `201 Agent` |
| GET | `/api/v1/agents` | 列出 Agents | — | `Agent[]` |
| GET | `/api/v1/agents/:id` | 获取 Agent | — | `Agent` |

> 注意：没有 PATCH / DELETE 端点。Agent 一旦创建不可通过 API 修改或删除。

**创建 Agent 副作用**：
1. 检查 `openclaw.json` 中是否已存在同 ID 的 Agent
2. 注册到 `~/.openclaw/openclaw.json`（agents.list + allowAgents + agentToAgent.allow）
3. 创建 workspace 和 agent 目录

**列出 Agents 逻辑**：
1. 直接从 `openclaw.json` 读取 main + `allowAgents` 白名单
2. 转换为 `Agent` 对象返回（不经过 DB）

### 5.2 Task API

| 方法 | 端点 | 描述 | 请求 | 响应 |
|------|------|------|------|------|
| POST | `/api/v1/tasks` | 创建任务并执行 | `{content, agentId?}` | `201 Task` |
| GET | `/api/v1/tasks` | 列出任务 | `?agentId=&status=&limit=50` | `Task[]` |
| GET | `/api/v1/tasks/:id` | 获取任务 | — | `Task` |
| PATCH | `/api/v1/tasks/:id` | 更新任务 | `{title?}` | `Task` |
| POST | `/api/v1/tasks/:id/cancel` | 取消任务 | — | `Task` |
| DELETE | `/api/v1/tasks/:id` | 删除任务 | — | `204` |

**创建任务流程**：
```
POST {content, agentId} →
  1. TaskManager.createTask()          — 生成 Task（标题=前20字）
  2. Repository.createMessage()         — 保存用户消息
  3. EventBroadcaster.broadcast()       — SSE 广播 task.created + message.created
  4. TaskExecutor.executeTask()          — 异步启动执行（不阻塞响应）
  5. 返回 201 Task
```

### 5.3 Message API

| 方法 | 端点 | 描述 | 请求 | 响应 |
|------|------|------|------|------|
| POST | `/api/v1/tasks/:id/messages` | 发送消息 | `{content}` | `{ok: true}` |
| GET | `/api/v1/tasks/:id/messages` | 消息历史 | — | `Message[]` |

**注意**：`sendMessage` 返回 `{ok: true}` 而非 Message。消息保存后异步转发给 Gateway，Agent 回复通过 SSE 推送。

### 5.4 SSE 事件

| 端点 | 描述 |
|------|------|
| GET `/api/v1/events` | 全局事件流 |
| GET `/api/v1/tasks/:id/events` | 单任务事件流 |

**事件类型**：

| 事件名 | 数据 | 说明 |
|--------|------|------|
| `task.created` | 完整 Task 对象 | 新任务创建 |
| `task.updated` | 完整 Task 对象 | 任务状态变更 |
| `message.created` | 完整 Message 对象 | 新消息（用户或 Agent） |
| `heartbeat` | `{timestamp}` | 30秒心跳保活 |

**实时性保障**：SSE + 前端轮询双重机制
- AgentInboxPage：每 5 秒轮询任务列表
- TaskDetailPage：每 3 秒轮询消息 + 任务状态

### 5.5 其他端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 `{status: 'ok', timestamp}` |
| GET | `/api/v1/openclaw/models` | 列出可用 AI 模型 |

---

## 6. OpenClaw Gateway Adapter

### 6.1 连接方式

使用 **WebSocket Protocol v3**（非 HTTP），以 `operator` 角色连接。

```
环境变量：
  OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
  OPENCLAW_GATEWAY_TOKEN=<auth-token>
  OPENCLAW_GATEWAY_TIMEOUT=300000  (默认 5 分钟)
```

### 6.2 认证握手

```
1. WebSocket 连接建立
2. Gateway 发送 event: connect.challenge
3. 客户端发送 connect 请求：
   {
     type: 'req', method: 'connect',
     params: {
       minProtocol: 3, maxProtocol: 3,
       role: 'operator',
       scopes: ['operator.read', 'operator.write'],
       auth: { token: '<gateway-token>' }
     }
   }
4. Gateway 响应 { ok: true } → 认证完成
```

### 6.3 通信方法

| 方法 | 用途 | 参数 |
|------|------|------|
| `chat.send` | 发送消息到 Agent | `{sessionKey, message, idempotencyKey}` |
| `chat.abort` | 中止执行 | `{sessionKey}` |

**sessionKey 格式**：`agent:{agentId}:main`

> **关键陷阱**：Gateway 会将 sessionKey 转为小写。如果 ID 包含大写字符（如 ULID），必须先 `.toLowerCase()`。

### 6.4 流式接收

Gateway 通过 WebSocket event 帧推送 chat 事件：

```typescript
interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;       // 消息内容（文本或结构化）
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}
```

- `delta`：流式中间结果，累积文本
- `final`：最终完整回复 → 创建 agent Message + 更新任务为 completed
- `error`：执行出错 → 创建 error Message + 更新任务为 failed
- `aborted`：被中止

### 6.5 重连策略

- 最多 10 次重试
- 指数退避：1s → 2s → 4s → ... → 最大 30s
- 连接断开时自动 reject 所有 pending requests

### 6.6 透明通道设计

Adapter **不做**以下事情（与旧需求的重要区别）：
- ❌ 意图识别 / 置信度计算
- ❌ 工具白名单过滤
- ❌ 高危命令检测 / 二次确认
- ❌ prompt 拼接 / 系统指令注入
- ❌ 参数转换 / 结果格式化

用户消息 **原样透传** 给 Gateway，Gateway 全权决定如何处理。

---

## 7. Agent 管理

### 7.1 单一来源原则

Agent 配置的唯一存储位置是 `~/.openclaw/openclaw.json`，**不写入数据库**。

```
openclaw.json (allowAgents) ──→ GET /api/v1/agents ──→ 前端显示
```

- 只显示白名单内的 Agent（main 自身 + allowAgents 列出的 ID）
- Agent API 直接读写 openclaw.json，不经过 DB

### 7.2 创建 Agent

通过 UI 创建 Agent 时：
1. 验证 ID 格式（`/^[a-z0-9][a-z0-9-]*$/`）
2. 检查 `openclaw.json` 中是否已存在同 ID
3. 调用 `registerAgent()` 注册到 `openclaw.json`：
   - 添加到 `agents.list`（含 workspace、agentDir、model）
   - 添加到 `tools.agentToAgent.allow`
   - 添加到主 agent 的 `subagents.allowAgents`
4. 创建目录：`workspace-{id}/`、`agents/{id}/agent/`、`agents/{id}/sessions/`

### 7.3 不支持修改和删除

UI 不提供修改或删除 Agent 功能。
- 设计原则：「可以适当创建，但不修改、删除 OpenClaw 本身存在的东西」

---

## 8. 前端实现细节

### 8.1 状态管理

使用 React `useReducer` 实现 Redux-like store：

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

- `ADD_*` 自动去重（按 id）
- `ADD_TASK` 追加到列表头部（最新的在前）
- `ADD_MESSAGE` 按 taskId 分组存储

### 8.2 SSE 客户端

全局 SSE 连接 `/api/v1/events`，在 App 根组件初始化：

```typescript
// SSEConnector 组件
onEvent('task.created', (data) => dispatch({ type: 'ADD_TASK', task: data }))
onEvent('task.updated', (data) => dispatch({ type: 'UPDATE_TASK', task: data }))
onEvent('message.created', (data) => dispatch({ type: 'ADD_MESSAGE', message: data }))
```

自动重连：断开 3 秒后重试。

### 8.3 乐观更新

发送消息时立即在 UI 显示用户消息（不等 SSE 推送）：

```typescript
const optimisticMsg: Message = {
  id: `tmp_${Date.now()}`,    // 临时 ID
  taskId: id,
  senderType: 'user',
  content: text,
  timestamp: Date.now(),
};
dispatch({ type: 'ADD_MESSAGE', message: optimisticMsg });
await sendMessage(id, text);  // 异步发送，不阻塞 UI
```

### 8.4 轮询备选

SSE 在某些网络环境下不稳定，前端加入轮询作为备选：

| 页面 | 轮询间隔 | 轮询内容 |
|------|----------|----------|
| AgentInboxPage | 5 秒 | 任务列表 |
| TaskDetailPage | 3 秒 | 任务状态 + 消息列表 |

### 8.5 UI 组件

| 组件 | 文件 | 说明 |
|------|------|------|
| AgentCard | `components/AgentCard.tsx` | Agent 卡片（头像、名称、描述、模型、任务数） |
| TaskItem | `components/TaskItem.tsx` | 任务列表项（标题、最后消息预览、状态、时间） |
| MessageBubble | `components/MessageBubble.tsx` | 消息气泡（用户蓝色右对齐、Agent 灰色左对齐） |
| TaskStatusBadge | `components/TaskStatusBadge.tsx` | 状态徽章（6种状态各有颜色） |
| ErrorBoundary | `components/ErrorBoundary.tsx` | 全局错误捕获 |

---

## 9. 服务端模块

### 9.1 数据库初始化（db/schema.ts）

- 创建 `tasks`、`messages` 两张表
- WAL 模式 + 外键约束
- Agent 不存储在 DB 中（由 openclaw.json 管理）

### 9.2 数据仓储（db/repository.ts）

| 方法 | 说明 |
|------|------|
| `createTask / getTask / listTasks / updateTask / deleteTask` | Task CRUD |
| `createMessage / listMessages` | Message 读写 |

> 注意：没有 Agent 相关方法。Agent 的读写由 `openclaw-config.ts` 直接操作 openclaw.json。

### 9.3 任务管理器（services/task-manager.ts）

- `createTask(req)`：生成 ULID、标题截断20字、默认 agentId='main'
- `listTasks(options)`：支持 status/agentId/limit 过滤
- `cancelTask(id)`：标记 cancelled
- 状态转换验证

### 9.4 任务执行器（services/task-executor.ts）

异步执行引擎，处理两种场景：

| 方法 | 场景 | 流程 |
|------|------|------|
| `executeTask(taskId, content)` | 新任务首次执行 | pending → running → adapter.execute() → completed/failed |
| `sendMessage(taskId, content)` | 已有任务追加消息 | 保存消息 → running → adapter.sendMessage() → completed/failed |

每个 `ExecutionEvent`（result/error）都会：
1. 创建 agent Message 写入 DB
2. 通过 SSE 广播 `message.created`
3. 更新任务状态并广播 `task.updated`

### 9.5 事件广播器（services/event-broadcaster.ts）

- 管理所有 SSE 客户端连接
- `broadcast(eventType, data, taskId?)`：广播给全局或指定任务的客户端
- 30 秒心跳保活
- 自动清理断开的连接

### 9.6 OpenClaw 配置管理（services/openclaw-config.ts）

| 函数 | 说明 |
|------|------|
| `listConfiguredAgents()` | 从 openclaw.json 读取 main + allowAgents 白名单 |
| `listAvailableModels()` | 从 `agents.defaults.models` 读取模型列表 |
| `registerAgent(id, name, model?)` | 注册新 agent 到 openclaw.json + 创建目录 |

---

## 10. 核心数据流

### 10.1 创建任务

```
用户输入 "帮我查快递"
     │
     ▼
POST /api/v1/tasks {content: "帮我查快递", agentId: "main"}
     │
     ▼
TaskManager.createTask()
  → Task {id: "01J...", title: "帮我查快递", status: "pending"}
     │
     ▼
Repository.createMessage()
  → Message {senderType: "user", content: "帮我查快递"}
     │
     ▼
SSE 广播 task.created + message.created
     │
     ▼
TaskExecutor.executeTask()     ← 异步，不阻塞 HTTP 响应
  → Task.status = "running"
  → SSE 广播 task.updated
     │
     ▼
OpenClawAdapter.execute()
  → chat.send {sessionKey: "agent:main:main", message: "帮我查快递"}
     │
     ▼
Gateway 处理 → 流式返回 chat events
  delta → delta → delta → final
     │
     ▼
final → 创建 agent Message → SSE 广播 message.created
     → Task.status = "completed" → SSE 广播 task.updated
```

### 10.2 追加消息

```
用户在已有任务中输入 "查不到，换个方式试试"
     │
     ▼
POST /api/v1/tasks/:id/messages {content: "..."}
     │
     ▼
创建 user Message → SSE 广播 message.created
     │
     ▼
TaskExecutor.sendMessage()
  → Task.status = "running"
  → adapter.sendMessage(task, content)  ← 同一个 sessionKey，延续上下文
  → Gateway 回复 → agent Message → completed
```

---

## 11. 配置

### 11.1 环境变量（.env）

```bash
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789   # Gateway WebSocket 地址
OPENCLAW_GATEWAY_TOKEN=<token>                # 认证令牌
OPENCLAW_GATEWAY_TIMEOUT=300000               # 超时 ms（默认 5 分钟）
PORT=3001                                     # 服务端监听端口
```

### 11.2 Vite 开发代理

```typescript
// vite.config.ts
proxy: {
  '/api': { target: 'http://localhost:3001' },
  '/health': { target: 'http://localhost:3001' },
}
```

---

## 12. 已实现与未实现

### 12.1 已实现 (v0.2.0)

| 模块 | 功能 |
|------|------|
| **多 Agent** | Agent 创建、列表、模型绑定、与 openclaw.json 同步 |
| **任务管理** | 创建、列表、过滤、删除、取消 |
| **消息** | 发送、历史查看、乐观更新 |
| **实时通信** | SSE 事件流 + 轮询备选 |
| **执行引擎** | 异步执行、状态流转、Gateway 透传 |
| **Gateway 对接** | WebSocket v3 完整实现（认证、chat、abort、重连） |
| **Agent 隔离** | 每个 Agent 独立 sessionKey，上下文互不干扰 |
| **标题编辑** | 任务标题可点击编辑 |
| **状态展示** | 6 种状态的彩色徽章 |
| **PWA 配置** | vite-plugin-pwa 已集成 |

### 12.2 未实现（计划中）

| 功能 | 说明 |
|------|------|
| 数据导出/导入 | JSON 格式导出、导入、擦除 |
| 浏览器推送通知 | 任务完成时的系统级通知 |
| PWA 离线缓存 | Service Worker 离线支持 |
| Markdown 渲染 | Agent 回复的 Markdown 格式化显示 |
| 搜索 | 任务和消息的全文搜索 |
| 任务自动归类 | AI 自动为任务添加标签/分类 |
| 快捷操作按钮 | Agent 消息中嵌入的交互按钮 |
| Agent 间编排 | 主 Agent 调度子 Agent 执行任务 |

---

## 13. 关键陷阱与注意事项

| 陷阱 | 说明 |
|------|------|
| **sessionKey 大小写** | Gateway 会将 sessionKey 转为小写，构建时必须 `.toLowerCase()` |
| **listTasks 返回格式** | API 返回 `Task[]`（直接数组），不是 `{items, total}` |
| **sendMessage 返回** | 返回 `{ok: true}`，不是 Message 对象；消息由 SSE 异步推送 |
| **创建顺序** | 创建任务时必须先创建 user Message 再执行，否则 adapter 拿不到 history |
| **task.updated 事件** | SSE 事件需携带完整 Task 对象（前端用来整体替换） |
| **DB 文件名** | v0.2.0 使用 `agent_channel_v2.db`（区别于 v0.1.0 的 `agent_communication.db`） |
| **默认 agentId** | 未指定时默认为 `'main'` |
| **Vite SSE 代理** | 需在代理配置中禁用缓冲，否则 SSE 事件会被批量发送 |

---

## 14. 开发命令

```bash
# 安装依赖
pnpm install

# 启动开发（前后端并行）
pnpm dev

# 单独启动
pnpm --filter @openclaw/server dev    # 后端 :3001
pnpm --filter @openclaw/client dev    # 前端 :5173

# 构建
pnpm build

# Lint
pnpm lint
```

---

## 15. 版本历史

| 版本 | 日期 | 里程碑 |
|------|------|--------|
| v0.1.0 | 2026-02-09 | Inbox 模式重写 + 任务驱动 + Gateway 透传 |
| v0.1.1 | 2026-02-10 | WebSocket 原生协议（替代 HTTP+SSE） |
| v0.2.0 | 2026-02-14 | 多 Agent 架构 + 模型绑定 + openclaw.json 同步 |

---

*文档与代码同步 | 以代码为准*
