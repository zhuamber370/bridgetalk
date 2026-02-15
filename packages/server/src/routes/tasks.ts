import { Router } from 'express';
import type { TaskManager } from '../services/task-manager.js';
import type { TaskExecutor } from '../services/task-executor.js';
import type { EventBroadcaster } from '../services/event-broadcaster.js';
import type { Repository } from '../db/repository.js';
import type { CreateTaskRequest, SendMessageRequest, Message, Task } from '@bridgetalk/shared';
import { generateId, nowMs } from '@bridgetalk/shared';

// Helper function: dynamically fill parent task title for subtasks
function enrichTaskTitle(task: Task, repo: Repository): Task {
  if (task.parentTaskId && !task.titleLocked) {
    const parentTask = repo.getTask(task.parentTaskId);
    if (parentTask) {
      return { ...task, title: parentTask.title };
    }
  }
  return task;
}

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

      // Create user original message
      const userMsg: Message = {
        id: generateId(),
        taskId: task.id,
        senderType: 'user',
        content: body.content,
        timestamp: nowMs(),
      };
      repo.createMessage(userMsg);

      // Broadcast task creation event
      broadcaster.broadcast('task.created', { taskId: task.id, task }, task.id);

      // Auto start execution (async)
      executor.executeTask(task.id, body.content).catch(err => {
        console.error(`[executor] task ${task.id} failed:`, err);
      });

      // Dynamically fill parent task title for subtasks
      const enrichedTask = enrichTaskTitle(task, repo);
      res.status(201).json(enrichedTask);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/v1/tasks — 查询任务列表
  router.get('/', (req, res) => {
    try {
      const { status, limit, agentId } = req.query;
      const result = taskManager.listTasks({
        status: status as string | undefined,
        limit: limit ? Number(limit) : undefined,
        agentId: agentId as string | undefined,
      });
      // Dynamically fill parent task title for subtasks
      const enrichedTasks = result.items.map(task => enrichTaskTitle(task, repo));
      res.json(enrichedTasks);
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
      // Dynamically fill parent task title for subtasks
      const enrichedTask = enrichTaskTitle(task, repo);
      res.json(enrichedTask);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/v1/tasks/:id/messages — Send message
  router.post('/:id/messages', (req, res) => {
    try {
      const task = taskManager.getTask(req.params.id);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const body = req.body as SendMessageRequest;
      if (!body.content?.trim()) {
        res.status(400).json({ error: 'Content cannot be empty' });
        return;
      }

      // Send message to Agent and wait for response (async)
      executor.sendMessage(task.id, body.content).catch(err => {
        console.error(`[executor] sendMessage for task ${task.id} failed:`, err);
      });

      res.status(202).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/v1/tasks/:id/messages — Get message history
  router.get('/:id/messages', (req, res) => {
    try {
      const messages = repo.listMessages(req.params.id);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PATCH /api/v1/tasks/:id — Update task (title, etc.)
  router.patch('/:id', (req, res) => {
    try {
      const existing = taskManager.getTask(req.params.id);
      if (!existing) {
        res.status(404).json({ error: '任务不存在' });
        return;
      }
      const { title } = req.body as { title?: string };
      if (!title?.trim()) {
        res.status(400).json({ error: 'Title cannot be empty' });
        return;
      }
      const updated = repo.updateTask(req.params.id, { title: title.trim(), titleLocked: true });
      if (updated) {
        broadcaster.broadcast('task.updated', { taskId: updated.id, task: updated }, updated.id);
      }
      // Dynamically fill parent task title for subtasks
      const enrichedTask = updated ? enrichTaskTitle(updated, repo) : null;
      res.json(enrichedTask);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/v1/tasks/:id/cancel — Cancel task
  router.post('/:id/cancel', (req, res) => {
    try {
      const existing = taskManager.getTask(req.params.id);
      if (!existing) {
        res.status(404).json({ error: '任务不存在' });
        return;
      }
      const task = taskManager.cancelTask(req.params.id);
      if (!task) {
        res.status(400).json({ error: 'Cannot cancel this task' });
        return;
      }
      executor.cancelTask(req.params.id);
      broadcaster.broadcast('task.updated', { taskId: task.id, task }, task.id);
      // Dynamically fill parent task title for subtasks
      const enrichedTask = enrichTaskTitle(task, repo);
      res.json(enrichedTask);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // DELETE /api/v1/tasks/:id — Delete task
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
