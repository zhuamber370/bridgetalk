import type { Task, Message, ExecutionEvent, HealthStatus } from '@openclaw/shared';

export interface Adapter {
  id: string;
  name: string;
  version: string;

  execute(task: Task, history: Message[]): AsyncGenerator<ExecutionEvent>;
  sendMessage(taskId: string, content: string, history: Message[]): AsyncGenerator<ExecutionEvent>;
  cancel(taskId: string): void;
  health(): HealthStatus;
}
