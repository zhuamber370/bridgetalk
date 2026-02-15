#!/usr/bin/env node
/**
 * Session 同步工具
 * 从 OpenClaw sessions 文件解析协调记录并同步到数据库
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { initDatabase } from '../db/schema.js';
import { Repository } from '../db/repository.js';
import { generateId, nowMs } from '@bridgetalk/shared';
import type { Task, Message } from '@bridgetalk/shared';

interface SessionEvent {
  type: string;
  payload?: {
    message?: {
      role?: string;
      content?: string | Array<{ type: string; text?: string }>;
    };
    state?: string;
  };
}

function extractTextContent(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text || '')
      .join('');
  }
  return '';
}

function parseSessionFile(filePath: string): { role: string; content: string }[] {
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  const messages: { role: string; content: string }[] = [];

  for (const line of lines) {
    try {
      const event: SessionEvent = JSON.parse(line);
      if (event.payload?.message) {
        const msg = event.payload.message;
        const content = extractTextContent(msg.content);
        if (content && msg.role) {
          messages.push({ role: msg.role, content });
        }
      }
    } catch {
      // 忽略解析错误
    }
  }

  return messages;
}

function findRecentSessions(agentId: string, sinceMinutes = 60): string[] {
  const openclawHome = process.env.OPENCLAW_HOME || join(homedir(), '.openclaw');
  const sessionsDir = join(openclawHome, 'agents', agentId, 'sessions');

  try {
    const files = readdirSync(sessionsDir);
    const now = Date.now();
    const threshold = now - sinceMinutes * 60 * 1000;

    return files
      .filter(f => f.endsWith('.jsonl'))
      .map(f => join(sessionsDir, f))
      .filter(path => {
        const stat = statSync(path);
        return stat.mtimeMs > threshold;
      })
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  } catch {
    return [];
  }
}

async function main() {
  const db = initDatabase();
  const repo = new Repository(db);

  console.log('🔍 扫描最近 60 分钟的 session 文件...\n');

  const agents = ['coder', 'qa', 'writer'];
  let totalSynced = 0;

  for (const agentId of agents) {
    const sessions = findRecentSessions(agentId, 60);
    if (sessions.length === 0) {
      console.log(`  ${agentId}: 无新 session`);
      continue;
    }

    console.log(`  ${agentId}: 找到 ${sessions.length} 个 session`);

    for (const sessionPath of sessions) {
      const sessionId = sessionPath.split('/').pop()?.replace('.jsonl', '') || '';
      const messages = parseSessionFile(sessionPath);

      if (messages.length === 0) continue;

      // 检查是否已经同步过（通过检查是否存在该 session 的任务）
      const existingTasks = repo.listTasks({ agentId, limit: 100 });
      const alreadySynced = existingTasks.items.some(t =>
        t.title.includes(sessionId.substring(0, 8))
      );

      if (alreadySynced) continue;

      // 创建子任务
      const firstUserMsg = messages.find(m => m.role === 'user');
      const title = firstUserMsg?.content.substring(0, 50) || '协调任务';

      const subTask: Task = {
        id: generateId(),
        agentId,
        parentTaskId: undefined, // 暂时无法关联到主任务
        title: `${title} (session: ${sessionId.substring(0, 8)})`,
        titleLocked: true,
        status: 'completed',
        createdAt: statSync(sessionPath).mtimeMs,
        updatedAt: nowMs(),
        completedAt: nowMs(),
      };

      repo.createTask(subTask);

      // 创建消息
      for (const msg of messages) {
        const message: Message = {
          id: generateId(),
          taskId: subTask.id,
          senderType: msg.role === 'user' ? 'user' : 'agent',
          senderAgentId: msg.role === 'assistant' ? agentId : undefined,
          content: msg.content,
          timestamp: subTask.createdAt,
        };
        repo.createMessage(message);
      }

      console.log(`    ✅ 同步: ${title}`);
      totalSynced++;
    }
  }

  console.log(`\n✨ 完成！共同步 ${totalSynced} 个任务`);
  db.close();
}

main().catch(console.error);
