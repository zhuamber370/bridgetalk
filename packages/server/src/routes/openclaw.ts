import { Router } from 'express';
import { listAvailableModels } from '../services/openclaw-config.js';

export function createOpenClawRoutes(): Router {
  const router = Router();

  // GET /api/v1/openclaw/models — List available models
  router.get('/models', (_req, res) => {
    try {
      const models = listAvailableModels();
      res.json(models);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
