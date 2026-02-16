import { generateId, nowMs } from '@bridgetalk/shared';
import type { Message, CoordinationData, Task } from '@bridgetalk/shared';
import type { Adapter } from '../adapters/adapter.js';
import { Repository } from '../db/repository.js';
import { EventBroadcaster } from './event-broadcaster.js';
import { logger } from '../lib/logger.js';

export class TaskExecutor {
  // 🆕 Track sessionKey → subTaskId mapping
  private sessionToTask = new Map<string, string>();  // sessionKey → taskId

  constructor(
    private repo: Repository,
    private adapter: Adapter,
    private broadcaster: EventBroadcaster,
  ) {
    // 🆕 Register global chat event listener
    this.setupGlobalChatListener();
  }

  // 🆕 Set up global listener to capture all agent activity
  private setupGlobalChatListener(): void {
    if ('setGlobalChatListener' in this.adapter) {
      (this.adapter as any).setGlobalChatListener((payload: any) => {
        this.handleGlobalChatEvent(payload);
      });
    }
  }

  // 🆕 Handle global chat event (detect sub-agent activity + route messages)
  private handleGlobalChatEvent(payload: any): void {
    const sessionKey = payload.sessionKey as string;
    if (!sessionKey) return;

    // Parse sessionKey: format is "agent:{agentId}:{parentId}"
    const match = sessionKey.match(/^agent:([^:]+):(.+)$/);
    if (!match) return;

    const [, agentId, parentId] = match;

    // 🆕 Debug log
    logger.debug(`[Global] sessionKey: ${sessionKey}, state: ${payload.state}, agentId: ${agentId}`);

    // If it's main agent, skip (already has dedicated listener)
    if (agentId === 'main' || agentId === parentId) return;

    // Check if this is a sub-agent we care about
    const allowedAgents = ['coder', 'qa', 'writer'];
    if (!allowedAgents.includes(agentId)) return;

    // 🆕 Check if subtask was already created
    const existingTaskId = this.sessionToTask.get(sessionKey);

    if (!existingTaskId) {
      // First time detecting this sessionKey, create subtask
      logger.debug(`[TaskExecutor] Detected new sub-agent activity: ${agentId} (session: ${sessionKey})`);
      this.createSubTaskFromSession(sessionKey, agentId, payload);
      return;
    }

    // Subtask title was set at creation time, no longer update from messages

    // 🆕 Existing subtask, route message to that task
    if (payload.state === 'final') {
      // Received final message, write to subtask
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

        // Update subtask status to completed
        const updated = this.repo.updateTask(existingTaskId, { status: 'completed', completedAt: nowMs() });
        if (updated) {
          this.broadcaster.broadcast('task.updated', { taskId: existingTaskId, task: updated }, existingTaskId);
        }

        logger.debug(`[TaskExecutor] Subtask completed: ${existingTaskId} (${agentId})`);
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

    // If task_delegated, create subtask
    if (coordData.type === 'task_delegated' && coordData.to) {
      const parentTask = this.repo.getTask(taskId);
      const subTask: Task = {
        id: generateId(),
        agentId: coordData.to,           // subtask belongs to target agent
        parentTaskId: taskId,             // associate with main task
        title: parentTask?.title || coordData.summary, // use main task title
        titleLocked: false,               // allow title to dynamically follow main task
        status: 'running',
        createdAt: nowMs(),
        updatedAt: nowMs(),
      };

      this.repo.createTask(subTask);
      this.broadcaster.broadcast('task.created', { task: subTask });

      subTaskId = subTask.id;

      // Create delegation message (write to subtask)
      const delegateMsg: Message = {
        id: generateId(),
        taskId: subTask.id,
        senderType: 'user',  // main agent plays user role in subtask
        senderAgentId: coordData.from,
        content: coordData.summary,
        timestamp: nowMs(),
      };
      this.repo.createMessage(delegateMsg);
      this.broadcaster.broadcast('message.created', { taskId: subTask.id, message: delegateMsg }, subTask.id);

      // 🆕 Execute subtask immediately (background async execution, don't block main task)
      this.executeSubTask(subTask.id, coordData.summary).catch(err => {
        logger.error(`SubTask ${subTask.id} execution failed:`, err);
      });
    }

    // Create coordination message (write to main task)
    const msg: Message = {
      id: generateId(),
      taskId,
      senderType: 'system',
      senderAgentId: coordData.from,
      messageType: 'coordination',
      content: JSON.stringify({ ...coordData, subTaskId }),  // include subTaskId
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
      this.handleAgentError(task.id, `Execution failed: ${(err as Error).message || 'Execution error'}`);
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
      this.handleAgentError(taskId, `Execution failed: ${(err as Error).message || 'Execution error'}`);
    }
  }

  // Execute subtask (similar to executeTask, but without creating user message)
  private async executeSubTask(taskId: string, content: string): Promise<void> {
    const task = this.repo.getTask(taskId);
    if (!task) return;

      // Subtask is already set to running at creation, execute directly here
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
      this.handleAgentError(task.id, `Execution failed: ${(err as Error).message || 'Execution error'}`);
    }
  }

  // 🆕 Create subtask from session
  private createSubTaskFromSession(sessionKey: string, agentId: string, initialPayload: any): void {
    // 🆕 Find currently running main agent task as parent task
    const tasksResult = this.repo.listTasks();
    const runningMainTasks = tasksResult.items.filter(
      t => t.agentId === 'main' && t.status === 'running'
    );
    const parentTask = runningMainTasks.length > 0 ? runningMainTasks[0] : null;

    // 🆕 Subtask title: directly use parent task title (dynamic follow)
    const title = parentTask ? parentTask.title : 'Coordination Task';

    // Create subtask
    const subTask: Task = {
      id: generateId(),
      agentId,
      parentTaskId: parentTask?.id, // 🆕 Set parent task ID
      title,
      titleLocked: false, // Allow title to dynamically follow parent task
      status: 'running',
      createdAt: nowMs(),
      updatedAt: nowMs(),
    };

    this.repo.createTask(subTask);
    this.broadcaster.broadcast('task.created', { task: subTask });

    // Record sessionKey → taskId mapping
    this.sessionToTask.set(sessionKey, subTask.id);

    logger.debug(`[TaskExecutor] Created subtask: ${subTask.id} (${agentId}, parent: ${parentTask?.id || 'none'}, session: ${sessionKey.substring(0, 20)}...)`);
  }

  // Helper method: extract text content
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
