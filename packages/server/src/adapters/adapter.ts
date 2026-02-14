import type { Task, ExecutionEvent, HealthStatus } from '@openclaw/shared';

export interface Adapter {
  id: string;
  name: string;
  version: string;

  execute(task: Task, content: string): AsyncGenerator<ExecutionEvent>;
  sendMessage(task: Task, content: string): AsyncGenerator<ExecutionEvent>;
  cancel(taskId: string): void;
  health(): HealthStatus;
}
