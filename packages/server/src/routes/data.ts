import { Router } from 'express';
import { sha256 } from '@openclaw/shared';
import type { ExportData } from '@openclaw/shared';
import { Repository } from '../db/repository.js';

export function createDataRoutes(repo: Repository): Router {
  const router = Router();

  // POST /api/v1/export — 导出所有数据
  router.post('/export', (_req, res) => {
    try {
      const tasks = repo.getAllTasks();
      const messages = repo.getAllMessages();
      const updates = repo.getAllUpdates();
      const artifacts = repo.getAllArtifacts();

      const payload = JSON.stringify({ tasks, messages, updates, artifacts });
      const checksum = sha256(payload);

      const exportData: ExportData = {
        version: '1.0',
        exportedAt: Date.now(),
        checksum,
        tasks,
        messages,
        updates,
        artifacts,
      };

      res.json(exportData);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/v1/import — 导入数据
  router.post('/import', (req, res) => {
    try {
      const data = req.body as ExportData;
      if (!data.version || !data.checksum) {
        res.status(400).json({ error: '无效的导入数据格式' });
        return;
      }

      // Verify checksum
      const payload = JSON.stringify({
        tasks: data.tasks,
        messages: data.messages,
        updates: data.updates,
        artifacts: data.artifacts,
      });
      const computed = sha256(payload);

      if (computed !== data.checksum) {
        res.status(400).json({ error: '数据校验失败，文件可能已被篡改' });
        return;
      }

      // Wipe and reimport
      repo.wipeAll();

      for (const task of data.tasks) repo.createTask(task);
      for (const msg of data.messages) repo.createMessage(msg);
      for (const upd of data.updates) repo.createUpdate(upd);
      for (const art of data.artifacts) repo.createArtifact(art);

      res.json({ success: true, imported: {
        tasks: data.tasks.length,
        messages: data.messages.length,
        updates: data.updates.length,
        artifacts: data.artifacts.length,
      }});
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // DELETE /api/v1/data/wipe — 擦除所有数据
  router.delete('/data/wipe', (_req, res) => {
    try {
      repo.wipeAll();
      res.json({ success: true, message: '所有数据已擦除' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
