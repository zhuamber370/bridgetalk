import { Router } from 'express';
import type { Repository } from '../db/repository.js';
import type { CreateAgentRequest } from '@openclaw/shared';
import { nowMs } from '@openclaw/shared';
import { registerAgent } from '../services/openclaw-config.js';

export function createAgentRoutes(repo: Repository): Router {
  const router = Router();

  // POST /api/v1/agents — create agent
  router.post('/', (req, res) => {
    try {
      const body = req.body as CreateAgentRequest;
      if (!body.id?.trim()) {
        res.status(400).json({ error: 'Agent ID 不能为空' });
        return;
      }
      if (!body.name?.trim()) {
        res.status(400).json({ error: 'Agent 名称不能为空' });
        return;
      }
      // Validate ID format: lowercase letters, numbers, hyphens only
      if (!/^[a-z0-9][a-z0-9-]*$/.test(body.id)) {
        res.status(400).json({ error: 'Agent ID 只允许小写字母、数字和短横线，且不能以短横线开头' });
        return;
      }
      // Check duplicate
      if (repo.getAgent(body.id)) {
        res.status(409).json({ error: 'Agent ID 已存在' });
        return;
      }
      const now = nowMs();
      const agentName = body.name.trim();
      const agent = repo.createAgent({
        id: body.id,
        name: agentName,
        description: body.description?.trim(),
        createdAt: now,
        updatedAt: now,
      });

      // 同步注册到 OpenClaw 配置
      try {
        registerAgent(body.id, agentName);
      } catch (err) {
        console.error(`[openclaw] 注册 agent ${body.id} 失败:`, err);
      }

      res.status(201).json(agent);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/v1/agents — list agents
  router.get('/', (_req, res) => {
    try {
      const agents = repo.listAgents();
      res.json(agents);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/v1/agents/:id — get agent
  router.get('/:id', (req, res) => {
    try {
      const agent = repo.getAgent(req.params.id);
      if (!agent) {
        res.status(404).json({ error: 'Agent 不存在' });
        return;
      }
      res.json(agent);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PATCH /api/v1/agents/:id — update agent
  router.patch('/:id', (req, res) => {
    try {
      const existing = repo.getAgent(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Agent 不存在' });
        return;
      }
      const { name, description } = req.body as { name?: string; description?: string };
      const patches: Record<string, string | undefined> = {};
      if (name !== undefined) patches.name = name.trim();
      if (description !== undefined) patches.description = description.trim();
      const updated = repo.updateAgent(req.params.id, patches);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // DELETE /api/v1/agents/:id — delete agent (cannot delete 'main')
  router.delete('/:id', (req, res) => {
    try {
      if (req.params.id === 'main') {
        res.status(400).json({ error: '不能删除默认 Agent' });
        return;
      }
      const existing = repo.getAgent(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Agent 不存在' });
        return;
      }
      repo.deleteAgent(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
