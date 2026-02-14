import { generateId, nowMs } from '@openclaw/shared';
import type { Message } from '@openclaw/shared';
import type { Adapter } from '../adapters/adapter.js';
import { Repository } from '../db/repository.js';
import { EventBroadcaster } from './event-broadcaster.js';

// ─── Response Parsing ───

const TITLE_RE = /\[TITLE:\s*(.+?)\]/;

/** 从 Agent 回复中提取标题标记，返回 [清理后的内容, 标题 | null] */
function extractTitle(content: string): [string, string | null] {
  const match = content.match(TITLE_RE);
  if (!match) return [content, null];
  const title = match[1].trim();
  const cleaned = content.replace(TITLE_RE, '').trim();
  return [cleaned, title];
}

/** 判断 Agent 是否在向用户提问（需要人类回复） */
function isAskingQuestion(content: string): boolean {
  // 包含问号且不包含标题标记（有标题说明已经开始执行了）
  if (TITLE_RE.test(content)) return false;
  // 中文问号或英文问号
  return content.includes('？') || content.includes('?');
}

export class TaskExecutor {
  constructor(
    private repo: Repository,
    private adapter: Adapter,
    private broadcaster: EventBroadcaster,
  ) {}

  /** 处理 Agent 回复：提取标题、判断状态、存消息、广播 */
  private handleAgentResult(taskId: string, rawContent: string): void {
    const [content, newTitle] = extractTitle(rawContent);

    // 如果提取到标题且用户未手动修改过标题，更新任务标题
    if (newTitle) {
      const current = this.repo.getTask(taskId);
      if (current && !current.titleLocked) {
        const updated = this.repo.updateTask(taskId, { title: newTitle });
        this.broadcaster.broadcast('task.updated', { taskId, task: updated }, taskId);
      }
    }

    // 存 Agent 消息（用清理后的内容，去掉 [TITLE: ...] 标记）
    const msg: Message = {
      id: generateId(),
      taskId,
      senderType: 'agent',
      content: content || rawContent,
      timestamp: nowMs(),
    };
    this.repo.createMessage(msg);
    this.broadcaster.broadcast('message.created', { taskId, message: msg }, taskId);

    // 判断最终状态：在提问 → waiting，否则 → completed
    if (isAskingQuestion(rawContent)) {
      const waitingTask = this.repo.updateTask(taskId, { status: 'waiting' });
      this.broadcaster.broadcast('task.updated', { taskId, task: waitingTask }, taskId);
    } else {
      const completedTask = this.repo.updateTask(taskId, { status: 'completed', completedAt: nowMs() });
      this.broadcaster.broadcast('task.updated', { taskId, task: completedTask }, taskId);
    }
  }

  private handleAgentError(taskId: string, errorMessage: string): void {
    const msg: Message = {
      id: generateId(),
      taskId,
      senderType: 'agent',
      content: errorMessage,
      timestamp: nowMs(),
    };
    this.repo.createMessage(msg);
    this.broadcaster.broadcast('message.created', { taskId, message: msg }, taskId);

    const failedTask = this.repo.updateTask(taskId, { status: 'failed', completedAt: nowMs() });
    this.broadcaster.broadcast('task.updated', { taskId, task: failedTask }, taskId);
  }

  async executeTask(taskId: string): Promise<void> {
    const task = this.repo.getTask(taskId);
    if (!task) return;

    // Transition to running
    const runningTask = this.repo.updateTask(task.id, { status: 'running' });
    this.broadcaster.broadcast('task.updated', { taskId: task.id, task: runningTask }, task.id);

    try {
      const history = this.repo.listMessages(task.id);

      for await (const event of this.adapter.execute(task, history)) {
        if (event.type === 'result') {
          this.handleAgentResult(task.id, event.data.message);
        } else if (event.type === 'error') {
          this.handleAgentError(task.id, event.data.message);
        }
      }
    } catch (err) {
      this.handleAgentError(task.id, `执行失败: ${(err as Error).message || '执行出错'}`);
    }
  }

  async sendMessage(taskId: string, content: string): Promise<void> {
    const task = this.repo.getTask(taskId);
    if (!task) return;

    // Create user message
    const userMsg: Message = {
      id: generateId(),
      taskId,
      senderType: 'user',
      content,
      timestamp: nowMs(),
    };
    this.repo.createMessage(userMsg);
    this.broadcaster.broadcast('message.created', { taskId, message: userMsg }, taskId);

    // Transition to running
    const runningTask = this.repo.updateTask(taskId, { status: 'running', completedAt: undefined });
    this.broadcaster.broadcast('task.updated', { taskId, task: runningTask }, taskId);

    try {
      const history = this.repo.listMessages(taskId);

      for await (const event of this.adapter.sendMessage(taskId, content, history)) {
        if (event.type === 'result') {
          this.handleAgentResult(taskId, event.data.message);
        } else if (event.type === 'error') {
          this.handleAgentError(taskId, event.data.message);
        }
      }
    } catch (err) {
      this.handleAgentError(taskId, `执行失败: ${(err as Error).message || '执行出错'}`);
    }
  }

  cancelTask(taskId: string): void {
    this.adapter.cancel(taskId);
  }
}
