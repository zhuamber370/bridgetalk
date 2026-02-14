import { Router } from 'express';
import type { TaskManager } from '../services/task-manager.js';
import type { MessageHub } from '../services/message-hub.js';
import type { TaskExecutor } from '../services/task-executor.js';
import type { EventBroadcaster } from '../services/event-broadcaster.js';
import type { CreateTaskRequest, SendMessageRequest } from '@openclaw/shared';

export function createTaskRoutes(
  taskManager: TaskManager,
  messageHub: MessageHub,
  executor: TaskExecutor,
  broadcaster: EventBroadcaster,
): Router {
  const router = Router();

  // POST /api/v1/tasks — 创建任务
  router.post('/', (req, res) => {
    try {
      const body = req.body as CreateTaskRequest;
      if (!body.content?.trim()) {
        res.status(400).json({ error: '内容不能为空' });
        return;
      }

      const task = taskManager.createTask(body);

      // 创建系统消息
      messageHub.sendSystemMessage(task.id, `任务已创建: ${task.title}`, 'task_created');
      // 创建用户原始消息
      messageHub.sendUserMessage(task.id, { content: body.content });

      // 广播任务创建事件
      broadcaster.broadcast('task.created', { taskId: task.id, task }, task.id);

      // 自动开始执行（异步）
      executor.executeTask(task).catch(err => {
        console.error(`[executor] task ${task.id} failed:`, err);
      });

      res.status(201).json(task);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/v1/tasks — 查询任务列表
  router.get('/', (req, res) => {
    try {
      const { status, limit, offset } = req.query;
      const result = taskManager.listTasks({
        status: status as string | undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/v1/tasks/:id — 获取任务详情
  router.get('/:id', (req, res) => {
    try {
      const task = taskManager.getTask(req.params.id);
      if (!task) {
        res.status(404).json({ error: '任务不存在' });
        return;
      }
      res.json(task);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/v1/tasks/:id/cancel — 取消任务
  router.post('/:id/cancel', (req, res) => {
    try {
      executor.cancelTask(req.params.id);
      const task = taskManager.cancelTask(req.params.id);
      if (!task) {
        res.status(404).json({ error: '任务不存在或无法取消' });
        return;
      }
      broadcaster.broadcast('task.cancelled', { taskId: task.id, status: 'cancelled' }, task.id);
      res.json(task);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // POST /api/v1/tasks/:id/retry — 重试任务
  router.post('/:id/retry', (req, res) => {
    try {
      const task = taskManager.retryTask(req.params.id);
      if (!task) {
        res.status(404).json({ error: '任务不存在或无法重试' });
        return;
      }
      // Re-execute
      executor.executeTask(task).catch(err => {
        console.error(`[executor] retry task ${task.id} failed:`, err);
      });
      res.json(task);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // DELETE /api/v1/tasks/:id — 删除任务（软删除）
  router.delete('/:id', (req, res) => {
    try {
      taskManager.deleteTask(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/v1/tasks/:id/messages — 发送消息
  router.post('/:id/messages', (req, res) => {
    try {
      const task = taskManager.getTask(req.params.id);
      if (!task) {
        res.status(404).json({ error: '任务不存在' });
        return;
      }

      const body = req.body as SendMessageRequest;
      if (!body.content?.trim()) {
        res.status(400).json({ error: '内容不能为空' });
        return;
      }

      const message = messageHub.sendUserMessage(req.params.id, body);
      broadcaster.broadcast('message.created', { taskId: task.id, message }, task.id);
      res.status(202).json(message);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/v1/tasks/:id/messages — 获取消息历史
  router.get('/:id/messages', (req, res) => {
    try {
      const { limit, offset } = req.query;
      const messages = messageHub.listMessages(req.params.id, {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
