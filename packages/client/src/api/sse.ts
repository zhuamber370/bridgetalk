type SSEHandler = (event: string, data: unknown) => void;

export class SSEClient {
  private source: EventSource | null = null;
  private handlers: SSEHandler[] = [];
  private lastEventId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    this.disconnect();

    const fullUrl = this.lastEventId
      ? `${this.url}${this.url.includes('?') ? '&' : '?'}_lastEventId=${this.lastEventId}`
      : this.url;

    this.source = new EventSource(fullUrl);

    this.source.onopen = () => {
      console.log('[sse] connected:', this.url);
    };

    this.source.onerror = () => {
      console.log('[sse] error, reconnecting...');
      this.source?.close();
      this.scheduleReconnect();
    };

    // Listen to all named events
    const eventTypes = [
      'task.created', 'task.updated', 'task.completed',
      'task.failed', 'task.cancelled',
      'message.created', 'update.created', 'heartbeat',
    ];

    for (const type of eventTypes) {
      this.source.addEventListener(type, (e: MessageEvent) => {
        this.lastEventId = (e as MessageEvent & { lastEventId?: string }).lastEventId || null;
        try {
          const data = JSON.parse(e.data);
          this.handlers.forEach(h => h(type, data));
        } catch {
          // ignore parse errors
        }
      });
    }
  }

  onEvent(handler: SSEHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.source) {
      this.source.close();
      this.source = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }
}
