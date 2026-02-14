// ─── Task ───

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  titleLocked: boolean;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

// ─── Message ───

export type SenderType = 'user' | 'agent';

export interface Message {
  id: string;
  taskId: string;
  senderType: SenderType;
  content: string;
  timestamp: number;
}

// ─── API Types ───

export interface CreateTaskRequest {
  content: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface TaskListQuery {
  status?: string;
  limit?: number;
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
  type: 'result' | 'error';
  timestamp: number;
  data: { message: string; [key: string]: unknown };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  message?: string;
}
