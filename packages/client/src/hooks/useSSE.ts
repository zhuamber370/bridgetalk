import { useEffect, useRef } from 'react';
import { SSEClient } from '../api/sse';
import { useTaskStore } from '../store/task-store';
import { useMessageStore } from '../store/message-store';

export function useSSE() {
  const clientRef = useRef<SSEClient | null>(null);
  const { fetchTasks, updateTaskInList } = useTaskStore();
  const { addMessage } = useMessageStore();

  useEffect(() => {
    const sse = new SSEClient('/api/v1/events');
    clientRef.current = sse;

    sse.onEvent((event, data) => {
      const d = data as Record<string, unknown>;

      switch (event) {
        case 'task.created':
        case 'task.updated':
        case 'task.completed':
        case 'task.failed':
        case 'task.cancelled':
          fetchTasks();
          if (d.taskId && d.status) {
            updateTaskInList({ id: d.taskId as string, status: d.status as string } as never);
          }
          break;

        case 'message.created':
          if (d.taskId && d.message) {
            addMessage(d.taskId as string, d.message as never);
          }
          break;

        case 'heartbeat':
          break;
      }
    });

    sse.connect();

    return () => {
      sse.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
