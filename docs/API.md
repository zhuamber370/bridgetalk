# BridgeTalk API Documentation

This document provides detailed specifications for the BridgeTalk REST API and WebSocket interfaces.

---

## 🌐 General Information

### Base URL

```
Development: http://localhost:3001
Production: https://your-domain.com
```

### Request Headers

```http
Content-Type: application/json
```

### Response Format

Success response:

```json
{
  "id": "01HX...",
  "name": "助手",
  "model": "claude-opus-4-6",
  "createdAt": 1708070400000
}
```

Error response:

```json
{
  "error": "Invalid request",
  "message": "Missing required field: name"
}
```

---

## 📋 API Endpoints

### Agent Management

#### GET /api/v1/agents

Get list of all agents

**Request**:

```http
GET /api/v1/agents
```

**Response**:

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

Get details of a single agent

**Request**:

```http
GET /api/v1/agents/main
```

**Response**:

```json
{
  "id": "main",
  "name": "助手",
  "model": "claude-opus-4-6",
  "systemPrompt": "你是一个有帮助的 AI 助手...",
  "createdAt": 1708070400000
}
```

**Errors**:

- `404 Not Found` - Agent does not exist

#### POST /api/v1/agents

Create a new agent

**Request**:

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

**Field Description**:

| Field | Type | Required | Description |
|------|------|------|------|
| `id` | string | Yes | Agent unique identifier (English recommended) |
| `name` | string | Yes | Display name |
| `model` | string | Yes | AI model name (e.g., claude-opus-4-6) |
| `systemPrompt` | string | No | System prompt |

**Response**:

```json
{
  "id": "writer",
  "name": "写作助手",
  "model": "claude-opus-4-6",
  "systemPrompt": "你是一个专业的写作助手...",
  "createdAt": 1708070600000
}
```

**Errors**:

- `400 Bad Request` - Missing required fields or invalid field format
- `409 Conflict` - Agent ID already exists

---

### Task Management

#### GET /api/v1/tasks

Get list of tasks

**Request**:

```http
GET /api/v1/tasks?agentId=main&status=running&limit=50&offset=0
```

**Query Parameters**:

| Parameter | Type | Required | Description |
|------|------|------|------|
| `agentId` | string | No | Filter tasks by specific agent |
| `status` | string | No | Filter by status (pending/running/completed/failed/cancelled) |
| `limit` | number | No | Limit number of results (default 100) |
| `offset` | number | No | Pagination offset (default 0) |

**Response**:

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

**Note**: Returns an array, not `{ items: [...], total: ... }` format.

#### GET /api/v1/tasks/:id

Get details of a single task

**Request**:

```http
GET /api/v1/tasks/01HX...
```

**Response**:

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

**Errors**:

- `404 Not Found` - Task does not exist

#### POST /api/v1/tasks/:agentId/quick

Quickly create a task and send a message

This is the most commonly used API for starting a conversation quickly.

**Request**:

```http
POST /api/v1/tasks/main/quick
Content-Type: application/json

{
  "message": "帮我写一篇关于 TypeScript 的博客"
}
```

**Field Description**:

| Field | Type | Required | Description |
|------|------|------|------|
| `message` | string | Yes | User message content |
| `taskId` | string | No | Specify task ID (to continue existing task) |

**Response**:

```json
{
  "taskId": "01HX...",
  "messageId": "01HY..."
}
```

**Workflow**:

1. If `taskId` is provided and task exists → Continue that task
2. Otherwise → Create new task (title auto-generated)
3. Create user message
4. Execute task asynchronously in background (call AI)
5. Push results via SSE

**Errors**:

- `400 Bad Request` - Missing message field
- `404 Not Found` - Specified taskId does not exist

#### POST /api/v1/tasks/:id/messages

Send a new message to a task

**Request**:

```http
POST /api/v1/tasks/01HX.../messages
Content-Type: application/json

{
  "content": "请添加代码示例"
}
```

**Response**:

```json
{
  "ok": true
}
```

**Notes**:
- Messages are not returned immediately in the response
- Both user messages and AI replies are pushed asynchronously via SSE
- Client needs to listen to `message.created` events

**Errors**:

- `404 Not Found` - Task does not exist
- `400 Bad Request` - Task is already completed or cancelled

#### PATCH /api/v1/tasks/:id

Update task status

**Request**:

```http
PATCH /api/v1/tasks/01HX...
Content-Type: application/json

{
  "status": "cancelled"
}
```

**Updatable Fields**:

| Field | Type | Description |
|------|------|------|
| `status` | string | Task status (cancelled is the main use case) |
| `title` | string | Task title |

**Response**:

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

**Errors**:

- `404 Not Found` - Task does not exist
- `400 Bad Request` - Invalid status transition

---

### Message Management

#### GET /api/v1/tasks/:taskId/messages

Get all messages for a task

**Request**:

```http
GET /api/v1/tasks/01HX.../messages?limit=100&offset=0
```

**Query Parameters**:

| Parameter | Type | Required | Description |
|------|------|------|------|
| `limit` | number | No | Limit number of results (default 100) |
| `offset` | number | No | Pagination offset (default 0) |

**Response**:

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
    "content": "好的,我来帮你写一篇关于 TypeScript 的博客...",
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

**senderType Description**:

- `user` - Message sent by user
- `agent` - Message replied by AI
- `system` - System message (such as task status changes)

**Errors**:

- `404 Not Found` - Task does not exist

---

### System Information

#### GET /api/v1/health

Health check

**Request**:

```http
GET /api/v1/health
```

**Response**:

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

### Global Event Stream

#### GET /api/v1/events

Subscribe to global events (status changes for all tasks)

**Request**:

```http
GET /api/v1/events
Accept: text/event-stream
```

**Response**:

```
event: task.created
data: {"task":{"id":"01HX...","agentId":"main","title":"新任务","status":"pending",...}}

event: task.updated
data: {"taskId":"01HX...","task":{"id":"01HX...","status":"running",...}}

event: message.created
data: {"taskId":"01HX...","message":{"id":"01HY...","senderType":"user","content":"你好",...}}
```

**Event Types**:

| Event | Payload | Description |
|------|---------|------|
| `task.created` | `{ task: Task }` | New task created |
| `task.updated` | `{ taskId: string, task: Task }` | Task status updated |
| `message.created` | `{ taskId: string, message: Message }` | New message created |

**Client Example**:

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

// Disconnect
eventSource.close();
```

**Reconnection**:

Browser will automatically reconnect, supports `Last-Event-ID` header for resuming from breakpoint:

```http
GET /api/v1/events
Accept: text/event-stream
Last-Event-ID: 1234567890
```

### Task-level Event Stream

#### GET /api/v1/tasks/:id/events

Subscribe to detailed events for a single task (including execution logs, intermediate results, etc.)

**Request**:

```http
GET /api/v1/tasks/01HX.../events
Accept: text/event-stream
```

**Response**:

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

**Event Types**:

| Event | Payload | Description |
|------|---------|------|
| `task.log` | `{ level: string, message: string }` | Execution log |
| `task.progress` | `{ percent: number, message: string }` | Progress update |
| `task.result` | `{ content: string }` | Intermediate result |
| `task.error` | `{ message: string }` | Error message |

**Notes**:
- Event stream does not automatically close after task completion
- Client should manually close EventSource when leaving the page

---

## 🔐 Error Handling

### HTTP Status Codes

| Status Code | Description |
|--------|------|
| `200 OK` | Request successful |
| `201 Created` | Resource created successfully |
| `400 Bad Request` | Invalid request parameters |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Resource conflict (e.g., duplicate ID) |
| `500 Internal Server Error` | Internal server error |

### Error Response Format

```json
{
  "error": "Bad Request",
  "message": "Missing required field: name"
}
```

---

## 📊 Usage Examples

### Complete Conversation Flow

```typescript
// 1. Get list of agents
const agents = await fetch('/api/v1/agents').then(r => r.json());
const mainAgent = agents.find(a => a.id === 'main');

// 2. Create task and send first message
const { taskId } = await fetch(`/api/v1/tasks/${mainAgent.id}/quick`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '帮我写一篇博客' })
}).then(r => r.json());

// 3. Subscribe to global event stream
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
    console.log('任务完成!');
  }
});

// 4. Continue conversation
await fetch(`/api/v1/tasks/${taskId}/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: '请添加代码示例' })
});

// 5. Cancel task
await fetch(`/api/v1/tasks/${taskId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'cancelled' })
});

// 6. Cleanup
es.close();
```

---

## 🧪 Testing API

### Using curl

```bash
# Get agents
curl http://localhost:3001/api/v1/agents

# Create agent
curl -X POST http://localhost:3001/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{"id":"test","name":"测试","model":"claude-opus-4-6"}'

# Quick create task
curl -X POST http://localhost:3001/api/v1/tasks/main/quick \
  -H "Content-Type: application/json" \
  -d '{"message":"你好"}'

# Subscribe to SSE
curl -N http://localhost:3001/api/v1/events
```

### Using Postman/Insomnia

1. Import OpenAPI specification (if available)
2. Set Base URL to `http://localhost:3001`
3. Test each endpoint

---

## 📚 Related Documentation

- [Architecture Design](./ARCHITECTURE.md) - System architecture and data models
- [Deployment Guide](../DEPLOYMENT.md) - Production environment deployment
- [Contribution Guide](../CONTRIBUTING.md) - How to contribute code

---

<div align="center">
  <p>If you have any questions, feel free to submit an Issue</p>
</div>
