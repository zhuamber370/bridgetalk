// ─── Agent ───

export interface Agent {
  id: string;          // 如 'main', 'travel', 'code-review'
  name: string;        // 显示名称
  description?: string;
  model?: string;      // 绑定的模型，如 'openai-codex/gpt-5.2'
  createdAt: number;
  updatedAt: number;
}

export interface CreateAgentRequest {
  id: string;
  name: string;
  description?: string;
  model?: string;
}

// ─── Task ───

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting' | 'cancelled';

export interface Task {
  id: string;
  agentId: string;       // 关联的 Agent
  parentTaskId?: string; // 如果是子任务，指向主任务 ID
  title: string;
  titleLocked: boolean;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

// ─── Message ───

export type SenderType = 'user' | 'agent' | 'system';

export type MessageType = 'chat' | 'coordination';

export interface Message {
  id: string;
  taskId: string;
  senderType: SenderType;
  senderAgentId?: string;      // 发送者 agent ID（如 'main', 'writer'）
  messageType?: MessageType;    // 消息类型（默认 'chat'）
  content: string;
  timestamp: number;
}

// 协调数据结构（存储在 coordination 消息的 content 中，JSON 格式）
export interface CoordinationData {
  type: 'team_created' | 'task_delegated' | 'agent_reply' | 'result_merged';
  from: string;           // 发起方 agent ID
  to?: string;            // 接收方 agent ID（可选）
  summary: string;        // 简短描述
  detail?: string;        // 详细内容（可选）
  subTaskId?: string;     // 关联的子任务 ID（task_delegated 时使用）
}

// ─── API Types ───

export interface CreateTaskRequest {
  content: string;
  agentId?: string;    // 默认 'main'
}

export interface SendMessageRequest {
  content: string;
}

export interface TaskListQuery {
  status?: string;
  limit?: number;
  agentId?: string;
}

// ─── SSE Events ───

export type SSEEventType =
  | 'task.created'
  | 'task.updated'
  | 'message.created'
  | 'heartbeat';

export interface SSEEvent {
  id: string;
  event: SSEEventType;
  data: unknown;
  timestamp: number;
  taskId?: string;
}

// ─── Adapter Types ───

export interface ExecutionEvent {
  type: 'result' | 'error' | 'coordination';  // 新增 'coordination'
  timestamp: number;
  data: { message: string; [key: string]: unknown } | CoordinationData;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  message?: string;
}
