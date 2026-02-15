import { Router } from 'express';
import { listConfiguredAgents } from '../services/openclaw-config.js';

export function createOpenClawRoutes(): Router {
  const router = Router();

  // GET /api/v1/openclaw/agents — 列出 openclaw.json 中已配置的 agents
  router.get('/agents', (_req, res) => {
    try {
      const agents = listConfiguredAgents();
      res.json(agents.map((a) => ({
        id: a.id,
        name: a.name || a.id,
        workspace: a.workspace,
        model: a.model,
        isDefault: a.default,
      })));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
