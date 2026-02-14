type SSEHandler = (event: string, data: unknown) => void;

export class SSEClient {
  private es: EventSource | null = null;
  private handlers: SSEHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(): void {
    this.disconnect();
    this.es = new EventSource('/api/v1/events');

    const eventTypes = ['task.created', 'task.updated', 'message.created', 'heartbeat'];
    for (const type of eventTypes) {
      this.es.addEventListener(type, (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          this.handlers.forEach((h) => h(type, data));
        } catch {
          // ignore parse errors
        }
      });
    }

    this.es.onerror = () => {
      this.es?.close();
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
  }

  onEvent(handler: SSEHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.es?.close();
    this.es = null;
  }
}
