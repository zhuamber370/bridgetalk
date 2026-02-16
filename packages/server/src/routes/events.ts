import { Router } from 'express';
import type { EventBroadcaster } from '../services/event-broadcaster.js';

export function createEventRoutes(broadcaster: EventBroadcaster): Router {
  const router = Router();

  // GET /api/v1/events — Global event stream
  router.get('/events', (_req, res) => {
    broadcaster.addClient(res);
  });

  // GET /api/v1/tasks/:id/events — Single task event stream
  router.get('/tasks/:id/events', (req, res) => {
    broadcaster.addClient(res, req.params.id);
  });

  return router;
}
