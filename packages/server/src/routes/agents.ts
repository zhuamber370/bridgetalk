import { Router } from 'express';
import type { CreateAgentRequest, Agent } from '@openclaw/shared';
import { nowMs } from '@openclaw/shared';
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

  // POST /api/v1/agents — create agent（只写 openclaw.json）
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
      if (!/^[a-z0-9][a-z0-9-]*$/.test(body.id)) {
        res.status(400).json({ error: 'Agent ID 只允许小写字母、数字和短横线，且不能以短横线开头' });
        return;
      }

      // 检查 openclaw.json 中是否已存在
      const existing = listConfiguredAgents().find((a) => a.id === body.id);
      if (existing) {
        res.status(409).json({ error: 'Agent ID 已存在' });
        return;
      }

      const agentName = body.name.trim();
      const agentModel = body.model?.trim() || undefined;

      // 注册到 openclaw.json
      registerAgent(body.id, agentName, agentModel);

      // 返回 Agent 对象
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

  // GET /api/v1/agents — list agents（直接从 openclaw.json 读取）
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
        res.status(404).json({ error: 'Agent 不存在' });
        return;
      }
      res.json(configToAgent(ca));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
