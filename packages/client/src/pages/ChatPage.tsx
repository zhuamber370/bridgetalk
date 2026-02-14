import { useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { ChatArea } from '../components/chat/ChatArea';
import { InputBar } from '../components/layout/InputBar';
import { useTaskStore } from '../store/task-store';
import { useMessageStore } from '../store/message-store';
import { useSSE } from '../hooks/useSSE';

interface ChatPageProps {
  onOpenSettings?: () => void;
}

export function ChatPage({ onOpenSettings }: ChatPageProps) {
  const {
    tasks, activeTaskId, filter,
    fetchTasks, createTask, selectTask, setFilter,
    cancelTask, retryTask,
  } = useTaskStore();

  const { messages, fetchMessages, sendMessage } = useMessageStore();

  useSSE();

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch messages when active task changes
  useEffect(() => {
    if (activeTaskId) {
      fetchMessages(activeTaskId);
    }
  }, [activeTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTask = tasks.find(t => t.id === activeTaskId) || null;
  const activeMessages = activeTaskId ? (messages[activeTaskId] || []) : [];

  const handleSend = async (content: string) => {
    if (activeTaskId) {
      await sendMessage(activeTaskId, content);
    } else {
      // No active task — create a new one
      await createTask(content);
    }
  };

  const handleNewTask = () => {
    selectTask(null);
  };

  return (
    <AppShell
      tasks={tasks}
      activeTaskId={activeTaskId}
      onSelectTask={selectTask}
      onNewTask={handleNewTask}
      filter={filter}
      onFilterChange={setFilter}
      onOpenSettings={onOpenSettings}
    >
      <ChatArea
        messages={activeMessages}
        task={activeTask}
        onCancel={activeTaskId ? () => cancelTask(activeTaskId) : undefined}
        onRetry={activeTaskId ? () => retryTask(activeTaskId) : undefined}
      />
      <InputBar
        onSend={handleSend}
        placeholder={activeTask ? '继续对话...' : '输入您想做的事...'}
      />
    </AppShell>
  );
}
