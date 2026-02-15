import { Router } from 'express';
import type { CreateAgentRequest, Agent } from '@bridgetalk/shared';
import { nowMs } from '@bridgetalk/shared';
import { registerAgent, listConfiguredAgents } from '../services/openclaw-config.js';
import type { OpenClawAgentConfig } from '../services/openclaw-config.js';

function configToAgent(ca: OpenClawAgentConfig): Agent {
  const now = nowMs();
  return {
    id: ca.id,
    name: ca.name || ca.id,
    model: ca.model,
    createdAt: now,
    updatedAt: now,
  };
}

export function createAgentRoutes(): Router {
  const router = Router();

  // POST /api/v1/agents — create agent (only writes to openclaw.json)
  router.post('/', (req, res) => {
    try {
      const body = req.body as CreateAgentRequest;
      if (!body.id?.trim()) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }
      if (!body.name?.trim()) {
        res.status(400).json({ error: 'Agent name is required' });
        return;
      }
      if (!/^[a-z0-9][a-z0-9-]*$/.test(body.id)) {
        res.status(400).json({ error: 'Agent ID can only contain lowercase letters, numbers, and hyphens, and cannot start with a hyphen' });
        return;
      }

      // Check if already exists in openclaw.json
      const existing = listConfiguredAgents().find((a) => a.id === body.id);
      if (existing) {
        res.status(409).json({ error: 'Agent ID already exists' });
        return;
      }

      const agentName = body.name.trim();
      const agentModel = body.model?.trim() || undefined;

      // Register to openclaw.json
      registerAgent(body.id, agentName, agentModel);

      // Return Agent object
      const agent: Agent = {
        id: body.id,
        name: agentName,
        model: agentModel,
        createdAt: nowMs(),
        updatedAt: nowMs(),
      };
      res.status(201).json(agent);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/v1/agents — list agents (read directly from openclaw.json)
  router.get('/', (_req, res) => {
    try {
      const agents = listConfiguredAgents().map(configToAgent);
      res.json(agents);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/v1/agents/:id — get agent
  router.get('/:id', (req, res) => {
    try {
      const ca = listConfiguredAgents().find((a) => a.id === req.params.id);
      if (!ca) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(configToAgent(ca));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
