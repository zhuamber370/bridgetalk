import type {
  Task, Message, CreateTaskRequest, SendMessageRequest,
  TaskListResponse, ExportData,
} from '@openclaw/shared';

const BASE = '/api/v1';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Tasks
  createTask: (data: CreateTaskRequest) =>
    request<Task>(`${BASE}/tasks`, { method: 'POST', body: JSON.stringify(data) }),

  listTasks: (params?: { status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return request<TaskListResponse>(`${BASE}/tasks${query ? '?' + query : ''}`);
  },

  getTask: (id: string) =>
    request<Task>(`${BASE}/tasks/${id}`),

  cancelTask: (id: string) =>
    request<Task>(`${BASE}/tasks/${id}/cancel`, { method: 'POST' }),

  retryTask: (id: string) =>
    request<Task>(`${BASE}/tasks/${id}/retry`, { method: 'POST' }),

  deleteTask: (id: string) =>
    request<void>(`${BASE}/tasks/${id}`, { method: 'DELETE' }),

  // Messages
  sendMessage: (taskId: string, data: SendMessageRequest) =>
    request<Message>(`${BASE}/tasks/${taskId}/messages`, { method: 'POST', body: JSON.stringify(data) }),

  listMessages: (taskId: string) =>
    request<Message[]>(`${BASE}/tasks/${taskId}/messages`),

  // Data
  exportData: () =>
    request<ExportData>(`${BASE}/export`, { method: 'POST' }),

  importData: (data: ExportData) =>
    request<{ success: boolean }>(`${BASE}/import`, { method: 'POST', body: JSON.stringify(data) }),

  wipeData: () =>
    request<{ success: boolean }>(`${BASE}/data/wipe`, { method: 'DELETE' }),
};
