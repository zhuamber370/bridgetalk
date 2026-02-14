import { generateId, nowMs } from '@openclaw/shared';
import type { Message, SendMessageRequest, Action } from '@openclaw/shared';
import { Repository } from '../db/repository.js';

export class MessageHub {
  constructor(private repo: Repository) {}

  sendUserMessage(taskId: string, req: SendMessageRequest): Message {
    const message: Message = {
      id: generateId(),
      taskId,
      sender: { type: 'user', id: 'user_self' },
      content: req.content,
      contentType: req.contentType || 'text',
      status: 'sent',
      timestamp: nowMs(),
      replyTo: req.replyTo,
    };

    this.repo.createMessage(message);

    // Add message ID to task
    const task = this.repo.getTask(taskId);
    if (task) {
      this.repo.updateTask(taskId, {
        messageIds: [...task.messageIds, message.id],
      });
    }

    return message;
  }

  sendAgentMessage(taskId: string, content: string, options?: {
    contentType?: Message['contentType'];
    cardData?: Message['cardData'];
    actions?: Action[];
  }): Message {
    const message: Message = {
      id: generateId(),
      taskId,
      sender: { type: 'agent', id: 'agent_main', name: 'OpenClaw Agent' },
      content,
      contentType: options?.contentType || 'text',
      cardData: options?.cardData,
      status: 'delivered',
      timestamp: nowMs(),
      actions: options?.actions,
    };

    this.repo.createMessage(message);

    const task = this.repo.getTask(taskId);
    if (task) {
      this.repo.updateTask(taskId, {
        messageIds: [...task.messageIds, message.id],
      });
    }

    return message;
  }

  sendSystemMessage(taskId: string, content: string, contentType: Message['contentType'] = 'task_created'): Message {
    const message: Message = {
      id: generateId(),
      taskId,
      sender: { type: 'system', id: 'system' },
      content,
      contentType,
      status: 'delivered',
      timestamp: nowMs(),
    };

    this.repo.createMessage(message);
    return message;
  }

  listMessages(taskId: string, options?: { limit?: number; offset?: number }): Message[] {
    return this.repo.listMessages(taskId, options);
  }
}
