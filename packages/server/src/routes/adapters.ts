import { Router } from 'express';
import type { AdapterInfo } from '@openclaw/shared';

export function createAdapterRoutes(): Router {
  const router = Router();

  // GET /api/v1/adapters — 列出可用适配器
  router.get('/', (_req, res) => {
    const adapters: AdapterInfo[] = [
      {
        id: 'mock',
        name: 'Mock Adapter',
        version: '1.0.0',
        status: 'healthy',
      },
      {
        id: 'kimi',
        name: 'Kimi K2.5',
        version: '1.0.0',
        status: process.env.KIMI_API_KEY ? 'healthy' : 'unavailable',
      },
      {
        id: 'openclaw',
        name: 'OpenClaw Gateway',
        version: '1.0.0',
        status: process.env.OPENCLAW_GATEWAY_URL ? 'healthy' : 'unavailable',
      },
    ];
    res.json(adapters);
  });

  // GET /api/v1/adapters/:id/health — 适配器健康检查
  router.get('/:id/health', (req, res) => {
    const { id } = req.params;
    if (id === 'mock') {
      res.json({ status: 'healthy' });
    } else if (id === 'kimi') {
      res.json({
        status: process.env.KIMI_API_KEY ? 'healthy' : 'unavailable',
        message: process.env.KIMI_API_KEY ? undefined : 'KIMI_API_KEY 未配置',
      });
    } else if (id === 'openclaw') {
      res.json({
        status: process.env.OPENCLAW_GATEWAY_URL ? 'healthy' : 'unavailable',
        message: process.env.OPENCLAW_GATEWAY_URL ? undefined : 'OPENCLAW_GATEWAY_URL 未配置',
      });
    } else {
      res.status(404).json({ error: '适配器不存在' });
    }
  });

  return router;
}
