import type { Task, Message, Agent, CreateAgentRequest } from '@bridgetalk/shared';

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

// ─── Agent API ───

export async function listAgents(): Promise<Agent[]> {
  return request<Agent[]>(`${BASE}/agents`);
}

export async function createAgent(req: CreateAgentRequest): Promise<Agent> {
  return request<Agent>(`${BASE}/agents`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getAgent(id: string): Promise<Agent> {
  return request<Agent>(`${BASE}/agents/${id}`);
}

// ─── OpenClaw API ───

export interface OpenClawModelInfo {
  id: string;
  alias?: string;
  isDefault?: boolean;
}

export async function listOpenClawModels(): Promise<OpenClawModelInfo[]> {
  return request<OpenClawModelInfo[]>(`${BASE}/openclaw/models`);
}

// ─── Task API ───

export async function createTask(content: string, agentId?: string): Promise<Task> {
  return request<Task>(`${BASE}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ content, agentId }),
  });
}

export async function listTasks(agentId?: string, status?: string, limit = 50): Promise<Task[]> {
  const params = new URLSearchParams();
  if (agentId) params.set('agentId', agentId);
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
