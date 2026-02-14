import type { TaskStatus } from '../types/index.js';

export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'waiting', 'cancelled'],
  completed: ['running'],      // 用户追加消息 → 恢复 running
  failed: ['running'],         // 重试
  waiting: ['running', 'cancelled'],  // 用户回复 → running
  cancelled: [],
};
