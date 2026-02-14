import type { Response } from 'express';
import { generateId, nowMs } from '@openclaw/shared';
import type { SSEEvent, SSEEventType } from '@openclaw/shared';
import { Repository } from '../db/repository.js';

interface SSEClient {
  id: string;
  res: Response;
  taskId?: string; // undefined = global subscriber
}

export class EventBroadcaster {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private repo: Repository) {
    this.startHeartbeat();
  }

  addClient(res: Response, taskId?: string, lastEventId?: string): string {
    const clientId = generateId();

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    this.clients.set(clientId, { id: clientId, res, taskId });

    // Send missed events if resuming
    if (lastEventId) {
      const missed = this.repo.getSSEEventsAfter(lastEventId, taskId);
      for (const event of missed) {
        this.sendToClient(res, event);
      }
    }

    // Handle disconnect
    res.on('close', () => {
      this.clients.delete(clientId);
    });

    return clientId;
  }

  broadcast(eventType: SSEEventType, data: unknown, taskId?: string): SSEEvent {
    const event: SSEEvent = {
      id: generateId(),
      event: eventType,
      data,
      timestamp: nowMs(),
      taskId,
    };

    // Persist event
    this.repo.createSSEEvent(event);

    // Send to matching clients
    for (const client of this.clients.values()) {
      const isGlobal = !client.taskId;
      const isTaskMatch = client.taskId === taskId;

      if (isGlobal || isTaskMatch) {
        this.sendToClient(client.res, event);
      }
    }

    return event;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.repo.cleanupOldSSEEvents();
  }

  private sendToClient(res: Response, event: SSEEvent): void {
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
      const heartbeat: SSEEvent = {
        id: generateId(),
        event: 'heartbeat',
        data: { timestamp: nowMs() },
        timestamp: nowMs(),
      };

      for (const client of this.clients.values()) {
        this.sendToClient(client.res, heartbeat);
      }
    }, 30_000);
  }
}
