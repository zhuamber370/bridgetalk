import type { Response } from 'express';
import { generateId, nowMs } from '@openclaw/shared';
import type { SSEEventType } from '@openclaw/shared';

interface SSEClient {
  id: string;
  res: Response;
  taskId?: string; // undefined = global subscriber
}

export class EventBroadcaster {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startHeartbeat();
  }

  addClient(res: Response, taskId?: string): string {
    const clientId = generateId();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    this.clients.set(clientId, { id: clientId, res, taskId });

    res.on('close', () => {
      this.clients.delete(clientId);
    });

    return clientId;
  }

  broadcast(eventType: SSEEventType, data: unknown, taskId?: string): void {
    const id = generateId();
    const event = { id, event: eventType, data, timestamp: nowMs(), taskId };

    for (const client of this.clients.values()) {
      const isGlobal = !client.taskId;
      const isTaskMatch = client.taskId === taskId;

      if (isGlobal || isTaskMatch) {
        this.sendToClient(client.res, event);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  private sendToClient(res: Response, event: { id: string; event: string; data: unknown }): void {
    try {
      res.write(`event: ${event.event}\n`);
      res.write(`id: ${event.id}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    } catch {
      // Client disconnected
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const id = generateId();
      const heartbeat = { id, event: 'heartbeat', data: { timestamp: nowMs() } };

      for (const client of this.clients.values()) {
        this.sendToClient(client.res, heartbeat);
      }
    }, 30_000);
  }
}
