import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider, useDispatch } from './lib/store';
import { SSEClient } from './lib/sse-client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InboxPage } from './pages/InboxPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import type { Task, Message } from '@openclaw/shared';
import './styles/index.css';

function SSEConnector() {
  const dispatch = useDispatch();

  useEffect(() => {
    const sse = new SSEClient();
    sse.connect();

    const unsub = sse.onEvent((event, data) => {
      if (event === 'heartbeat') return;

      if (event === 'task.created') {
        const payload = data as { task: Task };
        if (payload.task) {
          dispatch({ type: 'ADD_TASK', task: payload.task });
        }
      }

      if (event === 'task.updated') {
        const payload = data as { task: Task };
        if (payload.task) {
          dispatch({ type: 'UPDATE_TASK', task: payload.task });
        }
      }

      if (event === 'message.created') {
        const payload = data as { message: Message };
        if (payload.message) {
          dispatch({ type: 'ADD_MESSAGE', message: payload.message });
        }
      }
    });

    return () => {
      unsub();
      sse.disconnect();
    };
  }, [dispatch]);

  return null;
}

export function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <SSEConnector />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<InboxPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </ErrorBoundary>
  );
}
