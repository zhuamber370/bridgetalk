// ─── Core Data Models ───

export interface Task {
  id: string;
  title: string;
  content: string;
  status: TaskStatus;
  priority: Priority;
  createdAt: number;
  updatedAt: number;
  dueDate?: number;
  completedAt?: number;
  adapterId: string;
  confidence: number;
  intent: string;
  messageIds: string[];
  metadata: TaskMetadata;
  deletedAt?: number;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type Priority = 0 | 1 | 2;

export interface TaskMetadata {
  source: 'user' | 'system';
  tags: string[];
  isPinned: boolean;
}

export interface Message {
  id: string;
  taskId: string;
  sender: MessageSender;
  content: string;
  contentType: MessageContentType;
  cardData?: CardData;
  status: MessageStatus;
  timestamp: number;
  replyTo?: string;
  actions?: Action[];
}

export interface MessageSender {
  type: 'user' | 'agent' | 'system';
  id: string;
  name?: string;
}

export type MessageContentType = 'text' | 'card' | 'task_created' | 'task_update';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'error';

export interface CardData {
  type: 'confirm' | 'task' | 'result' | 'error';
  title: string;
  fields?: CardField[];
  content?: string;
}

export interface CardField {
  label: string;
  value: string;
}

export interface Action {
  type: 'button' | 'choice' | 'confirm' | 'link';
  id: string;
  label: string;
  style?: 'primary' | 'secondary' | 'danger';
  payload: unknown;
}

export interface Update {
  id: string;
  taskId: string;
  messageId: string;
  type: UpdateType;
  title: string;
  content: string;
  payload?: unknown;
  attachments?: Attachment[];
  createdAt: number;
}

export type UpdateType = 'status_change' | 'progress' | 'result' | 'error' | 'log';

export interface Attachment {
  name: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface Artifact {
  id: string;
  taskId: string;
  updateId?: string;
  name: string;
  mimeType: string;
  size: number;
  data?: string;
  storagePath?: string;
  createdAt: number;
  checksum: string;
}

// ─── API DTOs ───

export interface CreateTaskRequest {
  content: string;
  context?: {
    previousTaskId?: string;
    source?: 'user' | 'system';
  };
}

export interface SendMessageRequest {
  content: string;
  contentType?: MessageContentType;
  replyTo?: string;
  actionId?: string;
}

export interface TaskListQuery {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  hasMore: boolean;
}

export interface ExportRequest {
  startDate?: number;
  endDate?: number;
}

export interface ExportData {
  version: string;
  exportedAt: number;
  checksum: string;
  tasks: Task[];
  messages: Message[];
  updates: Update[];
  artifacts: Artifact[];
}

// ─── SSE Events ───

export interface SSEEvent {
  id: string;
  event: SSEEventType;
  data: unknown;
  timestamp: number;
  taskId?: string;
}

export type SSEEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  | 'message.created'
  | 'update.created'
  | 'heartbeat';

// ─── Adapter Types ───

export interface IntentScore {
  matched: boolean;
  confidence: number;
  intent: string;
}

export interface ExecutionEvent {
  type: 'log' | 'progress' | 'result' | 'error';
  timestamp: number;
  data: unknown;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  message?: string;
}

export interface AdapterInfo {
  id: string;
  name: string;
  version: string;
  status: HealthStatus['status'];
}

// ─── Safety Types ───

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ConfirmationCheck {
  requiresConfirmation: boolean;
  level?: 'warning' | 'danger';
  reason?: string;
  detail?: string;
}
