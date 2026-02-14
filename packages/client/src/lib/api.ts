import type { Task, Message } from '@openclaw/shared';

const BASE = '/api/v1';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function createTask(content: string): Promise<Task> {
  return request<Task>(`${BASE}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function listTasks(status?: string, limit = 50): Promise<Task[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', String(limit));
  return request<Task[]>(`${BASE}/tasks?${params}`);
}

export async function getTask(id: string): Promise<Task> {
  return request<Task>(`${BASE}/tasks/${id}`);
}

export async function sendMessage(taskId: string, content: string): Promise<Message> {
  return request<Message>(`${BASE}/tasks/${taskId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function listMessages(taskId: string): Promise<Message[]> {
  return request<Message[]>(`${BASE}/tasks/${taskId}/messages`);
}

export async function updateTask(id: string, patches: { title?: string }): Promise<Task> {
  return request<Task>(`${BASE}/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patches),
  });
}

export async function cancelTask(id: string): Promise<Task> {
  return request<Task>(`${BASE}/tasks/${id}/cancel`, { method: 'POST' });
}

export async function deleteTask(id: string): Promise<void> {
  return request<void>(`${BASE}/tasks/${id}`, { method: 'DELETE' });
}
