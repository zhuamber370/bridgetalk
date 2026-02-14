import { Router } from 'express';
import type { EventBroadcaster } from '../services/event-broadcaster.js';

export function createEventRoutes(broadcaster: EventBroadcaster): Router {
  const router = Router();

  // GET /api/v1/events — 全局事件流
  router.get('/events', (_req, res) => {
    broadcaster.addClient(res);
  });

  // GET /api/v1/tasks/:id/events — 单任务事件流
  router.get('/tasks/:id/events', (req, res) => {
    broadcaster.addClient(res, req.params.id);
  });

  return router;
}
