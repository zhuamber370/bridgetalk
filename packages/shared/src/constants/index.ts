import type { TaskStatus } from '../types/index.js';

export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'waiting', 'cancelled'],
  completed: ['running'],      // user appends message → resume running
  failed: ['running'],         // retry
  waiting: ['running', 'cancelled'],  // user replies → running
  cancelled: [],
};
