import { generateId, nowMs } from '@openclaw/shared';
import type { Message, CoordinationData, Task } from '@openclaw/shared';
import type { Adapter } from '../adapters/adapter.js';
import { Repository } from '../db/repository.js';
import { EventBroadcaster } from './event-broadcaster.js';

export class TaskExecutor {
  // 🆕 跟踪 sessionKey → subTaskId 的映射
  private sessionToTask = new Map<string, string>();  // sessionKey → taskId

  constructor(
    private repo: Repository,
    private adapter: Adapter,
    private broadcaster: EventBroadcaster,
  ) {
    // 🆕 注册全局 chat 事件监听器
    this.setupGlobalChatListener();
  }

  // 🆕 设置全局监听器，捕获所有 agent 的活动
  private setupGlobalChatListener(): void {
    if ('setGlobalChatListener' in this.adapter) {
      (this.adapter as any).setGlobalChatListener((payload: any) => {
        this.handleGlobalChatEvent(payload);
      });
    }
  }

  // 🆕 处理全局 chat 事件（检测子 agent 活动 + 路由消息）
  private handleGlobalChatEvent(payload: any): void {
    const sessionKey = payload.sessionKey as string;
    if (!sessionKey) return;

    // 解析 sessionKey：格式为 "agent:{agentId}:{parentId}"
    const match = sessionKey.match(/^agent:([^:]+):(.+)$/);
    if (!match) return;

    const [, agentId, parentId] = match;

    // 🆕 调试日志
    console.log(`[Global] sessionKey: ${sessionKey}, state: ${payload.state}, agentId: ${agentId}`);

    // 如果是 main agent，跳过（已经有专门的监听器）
    if (agentId === 'main' || agentId === parentId) return;

    // 检查是否是我们关心的子 agent
    const allowedAgents = ['coder', 'qa', 'writer'];
    if (!allowedAgents.includes(agentId)) return;

    // 🆕 检查是否已经创建过子任务
    const existingTaskId = this.sessionToTask.get(sessionKey);

    if (!existingTaskId) {
      // 第一次检测到这个 sessionKey，创建子任务
      console.log(`[TaskExecutor] 检测到新的子 agent 活动: ${agentId} (session: ${sessionKey})`);
      this.createSubTaskFromSession(sessionKey, agentId, payload);
      return;
    }

    // 子任务标题已在创建时设置好，不再从消息中更新

    // 🆕 已有子任务，路由消息到该任务
    if (payload.state === 'final') {
      // 收到最终消息，写入子任务
      const content = this.extractTextContent(payload.message);
      if (content) {
        const msg: Message = {
          id: generateId(),
          taskId: existingTaskId,
          senderType: 'agent',
          senderAgentId: agentId,
          content,
          timestamp: nowMs(),
        };

        this.repo.createMessage(msg);
        this.broadcaster.broadcast('message.created', { taskId: existingTaskId, message: msg }, existingTaskId);

        // 更新子任务状态为 completed
        const updated = this.repo.updateTask(existingTaskId, { status: 'completed', completedAt: nowMs() });
        if (updated) {
          this.broadcaster.broadcast('task.updated', { taskId: existingTaskId, task: updated }, existingTaskId);
        }

        console.log(`[TaskExecutor] 子任务完成: ${existingTaskId} (${agentId})`);
      }
    }
  }

  private handleAgentResult(taskId: string, content: string): void {
    const msg: Message = {
      id: generateId(),
      taskId,
      senderType: 'agent',
      content,
      timestamp: nowMs(),
    };
    this.repo.createMessage(msg);
    this.broadcaster.broadcast('message.created', { taskId, message: msg }, taskId);

    const completedTask = this.repo.updateTask(taskId, { status: 'completed', completedAt: nowMs() });
    this.broadcaster.broadcast('task.updated', { taskId, task: completedTask }, taskId);
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

  private async handleCoordinationEvent(taskId: string, coordData: CoordinationData): Promise<void> {
    const task = this.repo.getTask(taskId);
    if (!task) return;

    let subTaskId: string | undefined;

    // 如果是 task_delegated，创建子任务
    if (coordData.type === 'task_delegated' && coordData.to) {
      const parentTask = this.repo.getTask(taskId);
      const subTask: Task = {
        id: generateId(),
        agentId: coordData.to,           // 子任务归属目标 agent
        parentTaskId: taskId,             // 关联主任务
        title: parentTask?.title || coordData.summary, // 使用主任务标题
        titleLocked: false,               // 允许标题动态跟随主任务
        status: 'running',
        createdAt: nowMs(),
        updatedAt: nowMs(),
      };

      this.repo.createTask(subTask);
      this.broadcaster.broadcast('task.created', { task: subTask });

      subTaskId = subTask.id;

      // 创建委派消息（写入子任务）
      const delegateMsg: Message = {
        id: generateId(),
        taskId: subTask.id,
        senderType: 'user',  // 主 agent 在子任务中扮演 user 角色
        senderAgentId: coordData.from,
        content: coordData.summary,
        timestamp: nowMs(),
      };
      this.repo.createMessage(delegateMsg);
      this.broadcaster.broadcast('message.created', { taskId: subTask.id, message: delegateMsg }, subTask.id);

      // 🆕 立即执行子任务（后台异步执行，不阻塞主任务）
      this.executeSubTask(subTask.id, coordData.summary).catch(err => {
        console.error(`子任务 ${subTask.id} 执行失败:`, err);
      });
    }

    // 创建协调消息（写入主任务）
    const msg: Message = {
      id: generateId(),
      taskId,
      senderType: 'system',
      senderAgentId: coordData.from,
      messageType: 'coordination',
      content: JSON.stringify({ ...coordData, subTaskId }),  // 包含 subTaskId
      timestamp: nowMs(),
    };

    this.repo.createMessage(msg);
    this.broadcaster.broadcast('message.created', { taskId, message: msg }, taskId);
  }

  async executeTask(taskId: string, content: string): Promise<void> {
    const task = this.repo.getTask(taskId);
    if (!task) return;

    const runningTask = this.repo.updateTask(task.id, { status: 'running' });
    this.broadcaster.broadcast('task.updated', { taskId: task.id, task: runningTask }, task.id);

    try {
      for await (const event of this.adapter.execute(task, content)) {
        if (event.type === 'result') {
          const data = event.data as { message: string; [key: string]: unknown };
          this.handleAgentResult(task.id, data.message);
        } else if (event.type === 'error') {
          const data = event.data as { message: string; [key: string]: unknown };
          this.handleAgentError(task.id, data.message);
        } else if (event.type === 'coordination') {
          const coordData = event.data as CoordinationData;
          await this.handleCoordinationEvent(taskId, coordData);
        }
      }
    } catch (err) {
      this.handleAgentError(task.id, `执行失败: ${(err as Error).message || '执行出错'}`);
    }
  }

  async sendMessage(taskId: string, content: string): Promise<void> {
    const task = this.repo.getTask(taskId);
    if (!task) return;

    const userMsg: Message = {
      id: generateId(),
      taskId,
      senderType: 'user',
      content,
      timestamp: nowMs(),
    };
    this.repo.createMessage(userMsg);
    this.broadcaster.broadcast('message.created', { taskId, message: userMsg }, taskId);

    const runningTask = this.repo.updateTask(taskId, { status: 'running', completedAt: undefined });
    this.broadcaster.broadcast('task.updated', { taskId, task: runningTask }, taskId);

    try {
      for await (const event of this.adapter.sendMessage(task, content)) {
        if (event.type === 'result') {
          const data = event.data as { message: string; [key: string]: unknown };
          this.handleAgentResult(taskId, data.message);
        } else if (event.type === 'error') {
          const data = event.data as { message: string; [key: string]: unknown };
          this.handleAgentError(taskId, data.message);
        } else if (event.type === 'coordination') {
          const coordData = event.data as CoordinationData;
          await this.handleCoordinationEvent(taskId, coordData);
        }
      }
    } catch (err) {
      this.handleAgentError(taskId, `执行失败: ${(err as Error).message || '执行出错'}`);
    }
  }

  // 执行子任务（与 executeTask 类似，但不创建 user 消息）
  private async executeSubTask(taskId: string, content: string): Promise<void> {
    const task = this.repo.getTask(taskId);
    if (!task) return;

    // 子任务已经在创建时设置为 running，这里直接执行
    try {
      for await (const event of this.adapter.execute(task, content)) {
        if (event.type === 'result') {
          const data = event.data as { message: string; [key: string]: unknown };
          this.handleAgentResult(task.id, data.message);
        } else if (event.type === 'error') {
          const data = event.data as { message: string; [key: string]: unknown };
          this.handleAgentError(task.id, data.message);
        } else if (event.type === 'coordination') {
          const coordData = event.data as CoordinationData;
          await this.handleCoordinationEvent(taskId, coordData);
        }
      }
    } catch (err) {
      this.handleAgentError(task.id, `执行失败: ${(err as Error).message || '执行出错'}`);
    }
  }

  // 🆕 从 session 创建子任务
  private createSubTaskFromSession(sessionKey: string, agentId: string, initialPayload: any): void {
    // 🆕 查找当前 running 的 main agent 任务作为父任务
    const tasksResult = this.repo.listTasks();
    const runningMainTasks = tasksResult.items.filter(
      t => t.agentId === 'main' && t.status === 'running'
    );
    const parentTask = runningMainTasks.length > 0 ? runningMainTasks[0] : null;

    // 🆕 子任务标题：直接使用主任务标题（动态跟随）
    const title = parentTask ? parentTask.title : '协调任务';

    // 创建子任务
    const subTask: Task = {
      id: generateId(),
      agentId,
      parentTaskId: parentTask?.id, // 🆕 设置父任务 ID
      title,
      titleLocked: false, // 允许标题动态跟随主任务
      status: 'running',
      createdAt: nowMs(),
      updatedAt: nowMs(),
    };

    this.repo.createTask(subTask);
    this.broadcaster.broadcast('task.created', { task: subTask });

    // 记录 sessionKey → taskId 映射
    this.sessionToTask.set(sessionKey, subTask.id);

    console.log(`[TaskExecutor] 创建子任务: ${subTask.id} (${agentName}, parent: ${parentTask?.id || 'none'}, session: ${sessionKey.substring(0, 20)}...)`);
  }

  // 辅助方法：提取文本内容
  private extractTextContent(message: any): string {
    if (!message) return '';
    if (typeof message === 'string') return message;

    if (message.content) {
      if (typeof message.content === 'string') return message.content;
      if (Array.isArray(message.content)) {
        return message.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text || '')
          .join('');
      }
    }

    return '';
  }

  cancelTask(taskId: string): void {
    this.adapter.cancel(taskId);
  }
}
