# BridgeTalk API 文档

本文档详细说明 BridgeTalk 的 REST API 和 WebSocket 接口。

---

## 🌐 基础信息

### Base URL

```
开发环境：http://localhost:3001
生产环境：https://your-domain.com
```

### 请求头

```http
Content-Type: application/json
```

### 响应格式

成功响应：

```json
{
  "id": "01HX...",
  "name": "助手",
  "model": "claude-opus-4-6",
  "createdAt": 1708070400000
}
```

错误响应：

```json
{
  "error": "Invalid request",
  "message": "Missing required field: name"
}
```

---

## 📋 API 端点

### Agent 管理

#### GET /api/v1/agents

获取所有 agents 列表

**请求**：

```http
GET /api/v1/agents
```

**响应**：

```json
[
  {
    "id": "main",
    "name": "助手",
    "model": "claude-opus-4-6",
    "systemPrompt": "你是一个有帮助的 AI 助手...",
    "createdAt": 1708070400000
  },
  {
    "id": "coder",
    "name": "代码专家",
    "model": "claude-sonnet-4-5",
    "systemPrompt": "你是一个专业的程序员...",
    "createdAt": 1708070500000
  }
]
```

#### GET /api/v1/agents/:id

获取单个 agent 详情

**请求**：

```http
GET /api/v1/agents/main
```

**响应**：

```json
{
  "id": "main",
  "name": "助手",
  "model": "claude-opus-4-6",
  "systemPrompt": "你是一个有帮助的 AI 助手...",
  "createdAt": 1708070400000
}
```

**错误**：

- `404 Not Found` - Agent 不存在

#### POST /api/v1/agents

创建新 agent

**请求**：

```http
POST /api/v1/agents
Content-Type: application/json

{
  "id": "writer",
  "name": "写作助手",
  "model": "claude-opus-4-6",
  "systemPrompt": "你是一个专业的写作助手..."
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | Agent 唯一标识（建议使用英文） |
| `name` | string | 是 | 显示名称 |
| `model` | string | 是 | AI 模型名（如 claude-opus-4-6） |
| `systemPrompt` | string | 否 | 系统提示词 |

**响应**：

```json
{
  "id": "writer",
  "name": "写作助手",
  "model": "claude-opus-4-6",
  "systemPrompt": "你是一个专业的写作助手...",
  "createdAt": 1708070600000
}
```

**错误**：

- `400 Bad Request` - 缺少必填字段或字段格式错误
- `409 Conflict` - Agent ID 已存在

---

### 任务管理

#### GET /api/v1/tasks

获取任务列表

**请求**：

```http
GET /api/v1/tasks?agentId=main&status=running&limit=50&offset=0
```

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `agentId` | string | 否 | 过滤指定 agent 的任务 |
| `status` | string | 否 | 过滤指定状态（pending/running/completed/failed/cancelled） |
| `limit` | number | 否 | 返回数量限制（默认 100） |
| `offset` | number | 否 | 分页偏移量（默认 0） |

**响应**：

```json
[
  {
    "id": "01HX...",
    "agentId": "main",
    "title": "帮我写一篇博客",
    "description": null,
    "status": "running",
    "priority": null,
    "createdAt": 1708070700000,
    "updatedAt": 1708070750000,
    "completedAt": null,
    "parentTaskId": null
  }
]
```

**注意**：返回的是数组，不是 `{ items: [...], total: ... }` 格式。

#### GET /api/v1/tasks/:id

获取单个任务详情

**请求**：

```http
GET /api/v1/tasks/01HX...
```

**响应**：

```json
{
  "id": "01HX...",
  "agentId": "main",
  "title": "帮我写一篇博客",
  "description": null,
  "status": "completed",
  "priority": null,
  "createdAt": 1708070700000,
  "updatedAt": 1708070900000,
  "completedAt": 1708070900000,
  "parentTaskId": null
}
```

**错误**：

- `404 Not Found` - 任务不存在

#### POST /api/v1/tasks/:agentId/quick

快速创建任务并发送消息

这是最常用的 API，用于快速开始对话。

**请求**：

```http
POST /api/v1/tasks/main/quick
Content-Type: application/json

{
  "message": "帮我写一篇关于 TypeScript 的博客"
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | string | 是 | 用户消息内容 |
| `taskId` | string | 否 | 指定任务 ID（续接已有任务）|

**响应**：

```json
{
  "taskId": "01HX...",
  "messageId": "01HY..."
}
```

**工作流程**：

1. 如果提供 `taskId` 且任务存在 → 续接该任务
2. 否则 → 创建新任务（标题自动生成）
3. 创建用户消息
4. 后台异步执行任务（调用 AI）
5. 通过 SSE 推送结果

**错误**：

- `400 Bad Request` - 缺少 message 字段
- `404 Not Found` - 指定的 taskId 不存在

#### POST /api/v1/tasks/:id/messages

向任务发送新消息

**请求**：

```http
POST /api/v1/tasks/01HX.../messages
Content-Type: application/json

{
  "content": "请添加代码示例"
}
```

**响应**：

```json
{
  "ok": true
}
```

**注意**：
- 消息不会在响应中立即返回
- 用户消息和 AI 回复都会通过 SSE 异步推送
- 客户端需要监听 `message.created` 事件

**错误**：

- `404 Not Found` - 任务不存在
- `400 Bad Request` - 任务已完成或取消

#### PATCH /api/v1/tasks/:id

更新任务状态

**请求**：

```http
PATCH /api/v1/tasks/01HX...
Content-Type: application/json

{
  "status": "cancelled"
}
```

**可更新字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | 任务状态（cancelled 为主要用途）|
| `title` | string | 任务标题 |

**响应**：

```json
{
  "id": "01HX...",
  "agentId": "main",
  "title": "帮我写一篇博客",
  "status": "cancelled",
  "createdAt": 1708070700000,
  "updatedAt": 1708070950000,
  "completedAt": null,
  "parentTaskId": null
}
```

**错误**：

- `404 Not Found` - 任务不存在
- `400 Bad Request` - 无效的状态转换

---

### 消息管理

#### GET /api/v1/tasks/:taskId/messages

获取任务的所有消息

**请求**：

```http
GET /api/v1/tasks/01HX.../messages?limit=100&offset=0
```

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | number | 否 | 返回数量限制（默认 100） |
| `offset` | number | 否 | 分页偏移量（默认 0） |

**响应**：

```json
[
  {
    "id": "01HY...",
    "taskId": "01HX...",
    "senderType": "user",
    "content": "帮我写一篇关于 TypeScript 的博客",
    "timestamp": 1708070700000
  },
  {
    "id": "01HZ...",
    "taskId": "01HX...",
    "senderType": "agent",
    "content": "好的，我来帮你写一篇关于 TypeScript 的博客...",
    "timestamp": 1708070750000
  },
  {
    "id": "01J0...",
    "taskId": "01HX...",
    "senderType": "system",
    "content": "任务已完成",
    "timestamp": 1708070900000
  }
]
```

**senderType 说明**：

- `user` - 用户发送的消息
- `agent` - AI 回复的消息
- `system` - 系统消息（如任务状态变更）

**错误**：

- `404 Not Found` - 任务不存在

---

### 系统信息

#### GET /api/v1/health

健康检查

**请求**：

```http
GET /api/v1/health
```

**响应**：

```json
{
  "status": "ok",
  "adapters": {
    "openclaw": {
      "connected": true,
      "sessionCount": 1
    }
  }
}
```

---

## 📡 Server-Sent Events (SSE)

### 全局事件流

#### GET /api/v1/events

订阅全局事件（所有任务的状态变化）

**请求**：

```http
GET /api/v1/events
Accept: text/event-stream
```

**响应**：

```
event: task.created
data: {"task":{"id":"01HX...","agentId":"main","title":"新任务","status":"pending",...}}

event: task.updated
data: {"taskId":"01HX...","task":{"id":"01HX...","status":"running",...}}

event: message.created
data: {"taskId":"01HX...","message":{"id":"01HY...","senderType":"user","content":"你好",...}}
```

**事件类型**：

| 事件 | Payload | 说明 |
|------|---------|------|
| `task.created` | `{ task: Task }` | 新任务创建 |
| `task.updated` | `{ taskId: string, task: Task }` | 任务状态更新 |
| `message.created` | `{ taskId: string, message: Message }` | 新消息创建 |

**客户端示例**：

```typescript
const eventSource = new EventSource('/api/v1/events');

eventSource.addEventListener('task.created', (e) => {
  const { task } = JSON.parse(e.data);
  console.log('新任务:', task);
});

eventSource.addEventListener('task.updated', (e) => {
  const { taskId, task } = JSON.parse(e.data);
  console.log('任务更新:', taskId, task);
});

eventSource.addEventListener('message.created', (e) => {
  const { taskId, message } = JSON.parse(e.data);
  console.log('新消息:', taskId, message);
});

// 断开连接
eventSource.close();
```

**断线重连**：

浏览器会自动重连，支持 `Last-Event-ID` 头恢复断点：

```http
GET /api/v1/events
Accept: text/event-stream
Last-Event-ID: 1234567890
```

### 任务级别事件流

#### GET /api/v1/tasks/:id/events

订阅单个任务的详细事件（包括执行日志、中间结果等）

**请求**：

```http
GET /api/v1/tasks/01HX.../events
Accept: text/event-stream
```

**响应**：

```
event: task.log
data: {"level":"info","message":"开始执行任务..."}

event: task.progress
data: {"percent":50,"message":"正在生成代码..."}

event: task.result
data: {"content":"生成的代码内容..."}

event: task.error
data: {"message":"执行失败: 网络超时"}
```

**事件类型**：

| 事件 | Payload | 说明 |
|------|---------|------|
| `task.log` | `{ level: string, message: string }` | 执行日志 |
| `task.progress` | `{ percent: number, message: string }` | 进度更新 |
| `task.result` | `{ content: string }` | 中间结果 |
| `task.error` | `{ message: string }` | 错误信息 |

**注意**：
- 任务完成后事件流不会自动关闭
- 客户端应在离开页面时手动关闭 EventSource

---

## 🔐 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| `200 OK` | 请求成功 |
| `201 Created` | 资源创建成功 |
| `400 Bad Request` | 请求参数错误 |
| `404 Not Found` | 资源不存在 |
| `409 Conflict` | 资源冲突（如 ID 重复）|
| `500 Internal Server Error` | 服务器内部错误 |

### 错误响应格式

```json
{
  "error": "Bad Request",
  "message": "Missing required field: name"
}
```

---

## 📊 使用示例

### 完整对话流程

```typescript
// 1. 获取 agents 列表
const agents = await fetch('/api/v1/agents').then(r => r.json());
const mainAgent = agents.find(a => a.id === 'main');

// 2. 创建任务并发送第一条消息
const { taskId } = await fetch(`/api/v1/tasks/${mainAgent.id}/quick`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '帮我写一篇博客' })
}).then(r => r.json());

// 3. 订阅全局事件流
const es = new EventSource('/api/v1/events');

es.addEventListener('message.created', (e) => {
  const { taskId: msgTaskId, message } = JSON.parse(e.data);
  if (msgTaskId === taskId) {
    if (message.senderType === 'agent') {
      console.log('AI 回复:', message.content);
    }
  }
});

es.addEventListener('task.updated', (e) => {
  const { taskId: updTaskId, task } = JSON.parse(e.data);
  if (updTaskId === taskId && task.status === 'completed') {
    console.log('任务完成！');
  }
});

// 4. 续接对话
await fetch(`/api/v1/tasks/${taskId}/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: '请添加代码示例' })
});

// 5. 取消任务
await fetch(`/api/v1/tasks/${taskId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'cancelled' })
});

// 6. 清理
es.close();
```

---

## 🧪 测试 API

### 使用 curl

```bash
# 获取 agents
curl http://localhost:3001/api/v1/agents

# 创建 agent
curl -X POST http://localhost:3001/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{"id":"test","name":"测试","model":"claude-opus-4-6"}'

# 快速创建任务
curl -X POST http://localhost:3001/api/v1/tasks/main/quick \
  -H "Content-Type: application/json" \
  -d '{"message":"你好"}'

# 订阅 SSE
curl -N http://localhost:3001/api/v1/events
```

### 使用 Postman/Insomnia

1. 导入 OpenAPI 规范（如果有）
2. 设置 Base URL 为 `http://localhost:3001`
3. 测试各个端点

---

## 📚 相关文档

- [架构设计](./ARCHITECTURE.md) - 系统架构和数据模型
- [部署指南](../DEPLOYMENT.md) - 生产环境部署
- [贡献指南](../CONTRIBUTING.md) - 如何贡献代码

---

<div align="center">
  <p>如有疑问，欢迎提 Issue 反馈</p>
</div>
