import { create } from 'zustand';
import type { Task } from '@openclaw/shared';
import { api } from '../api/client';

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  filter: string;
  loading: boolean;

  fetchTasks: () => Promise<void>;
  createTask: (content: string) => Promise<Task>;
  selectTask: (taskId: string | null) => void;
  setFilter: (filter: string) => void;
  cancelTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  updateTaskInList: (task: Partial<Task> & { id: string }) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  filter: '',
  loading: false,

  fetchTasks: async () => {
    set({ loading: true });
    try {
      const { filter } = get();
      const result = await api.listTasks({ status: filter || undefined });
      set({ tasks: result.items, loading: false });
    } catch (err) {
      console.error('[task-store] fetchTasks error:', err);
      set({ loading: false });
    }
  },

  createTask: async (content: string) => {
    const task = await api.createTask({ content });
    set(s => ({
      tasks: [task, ...s.tasks],
      activeTaskId: task.id,
    }));
    return task;
  },

  selectTask: (taskId) => {
    set({ activeTaskId: taskId });
  },

  setFilter: (filter) => {
    set({ filter });
    get().fetchTasks();
  },

  cancelTask: async (taskId) => {
    const task = await api.cancelTask(taskId);
    get().updateTaskInList(task);
  },

  retryTask: async (taskId) => {
    const task = await api.retryTask(taskId);
    get().updateTaskInList(task);
  },

  deleteTask: async (taskId) => {
    await api.deleteTask(taskId);
    set(s => ({
      tasks: s.tasks.filter(t => t.id !== taskId),
      activeTaskId: s.activeTaskId === taskId ? null : s.activeTaskId,
    }));
  },

  updateTaskInList: (partial) => {
    set(s => ({
      tasks: s.tasks.map(t => t.id === partial.id ? { ...t, ...partial } : t),
    }));
  },
}));
