import type { Task, IntentScore, ExecutionEvent, HealthStatus } from '@openclaw/shared';

export interface Adapter {
  id: string;
  name: string;
  version: string;

  scoreIntent(content: string): IntentScore;
  execute(task: Task): AsyncGenerator<ExecutionEvent>;
  cancel(taskId: string): void;
  health(): HealthStatus;
}
