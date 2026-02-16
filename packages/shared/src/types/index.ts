// ─── Agent ───

export interface Agent {
  id: string;          // e.g., 'main', 'travel', 'code-review'
  name: string;        // display name
  description?: string;
  model?: string;      // bound model, e.g., 'openai-codex/gpt-5.2'
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
  agentId: string;       // associated Agent
  parentTaskId?: string; // if this is a subtask, points to the parent task ID
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
  senderAgentId?: string;      // sender agent ID (e.g., 'main', 'writer')
  messageType?: MessageType;    // message type (default 'chat')
  content: string;
  timestamp: number;
}

// Coordination data structure (stored in coordination message's content, JSON format)
export interface CoordinationData {
  type: 'team_created' | 'task_delegated' | 'agent_reply' | 'result_merged';
  from: string;           // initiating agent ID
  to?: string;            // receiving agent ID (optional)
  summary: string;        // brief description
  detail?: string;        // detailed content (optional)
  subTaskId?: string;     // associated subtask ID (used when task_delegated)
}

// ─── API Types ───

export interface CreateTaskRequest {
  content: string;
  agentId?: string;    // default 'main'
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
  type: 'result' | 'error' | 'coordination';  // added 'coordination'
  timestamp: number;
  data: { message: string; [key: string]: unknown } | CoordinationData;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  message?: string;
}
