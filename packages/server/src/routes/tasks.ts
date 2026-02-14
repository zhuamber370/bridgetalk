import { Router } from 'express';
import type { TaskManager } from '../services/task-manager.js';
import type { TaskExecutor } from '../services/task-executor.js';
import type { EventBroadcaster } from '../services/event-broadcaster.js';
import type { Repository } from '../db/repository.js';
import type { CreateTaskRequest, SendMessageRequest, Message } from '@openclaw/shared';
import { generateId, nowMs } from '@openclaw/shared';

export function createTaskRoutes(
  taskManager: TaskManager,
  executor: TaskExecutor,
  repo: Repository,
  broadcaster: EventBroadcaster,
): Router {
  const router = Router();

  // POST /api/v1/tasks — 创建任务并自动执行
  router.post('/', (req, res) => {
    try {
      const body = req.body as CreateTaskRequest;
      if (!body.content?.trim()) {
        res.status(400).json({ error: '内容不能为空' });
        return;
      }

      const task = taskManager.createTask(body);

      // 创建用户原始消息
      const userMsg: Message = {
        id: generateId(),
        taskId: task.id,
        senderType: 'user',
        content: body.content,
        timestamp: nowMs(),
      };
      repo.createMessage(userMsg);

      // 广播任务创建事件
      broadcaster.broadcast('task.created', { taskId: task.id, task }, task.id);

      // 自动开始执行（异步）
      executor.executeTask(task.id, body.content).catch(err => {
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
      const { status, limit } = req.query;
      const result = taskManager.listTasks({
        status: status as string | undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json(result.items);
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

      // 发送消息到 Agent 并等待回复（异步）
      executor.sendMessage(task.id, body.content).catch(err => {
        console.error(`[executor] sendMessage for task ${task.id} failed:`, err);
      });

      res.status(202).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/v1/tasks/:id/messages — 获取消息历史
  router.get('/:id/messages', (req, res) => {
    try {
      const messages = repo.listMessages(req.params.id);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PATCH /api/v1/tasks/:id — 更新任务（标题等）
  router.patch('/:id', (req, res) => {
    try {
      const existing = taskManager.getTask(req.params.id);
      if (!existing) {
        res.status(404).json({ error: '任务不存在' });
        return;
      }
      const { title } = req.body as { title?: string };
      if (!title?.trim()) {
        res.status(400).json({ error: '标题不能为空' });
        return;
      }
      const updated = repo.updateTask(req.params.id, { title: title.trim(), titleLocked: true });
      if (updated) {
        broadcaster.broadcast('task.updated', { taskId: updated.id, task: updated }, updated.id);
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/v1/tasks/:id/cancel — 取消任务
  router.post('/:id/cancel', (req, res) => {
    try {
      const existing = taskManager.getTask(req.params.id);
      if (!existing) {
        res.status(404).json({ error: '任务不存在' });
        return;
      }
      const task = taskManager.cancelTask(req.params.id);
      if (!task) {
        res.status(400).json({ error: '无法取消该任务' });
        return;
      }
      executor.cancelTask(req.params.id);
      broadcaster.broadcast('task.updated', { taskId: task.id, task }, task.id);
      res.json(task);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // DELETE /api/v1/tasks/:id — 删除任务
  router.delete('/:id', (req, res) => {
    try {
      taskManager.deleteTask(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
