import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import type { Task } from '@openclaw/shared';

interface AppShellProps {
  tasks: Task[];
  activeTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onNewTask: () => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  onOpenSettings?: () => void;
  children: React.ReactNode;
}

export function AppShell({ tasks, activeTaskId, onSelectTask, onNewTask, filter, onFilterChange, onOpenSettings, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const title = activeTask?.title || 'OpenClaw Agent';

  return (
    <div className="flex h-full">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        tasks={tasks}
        activeTaskId={activeTaskId}
        onSelectTask={onSelectTask}
        onNewTask={() => { onNewTask(); setSidebarOpen(false); }}
        filter={filter}
        onFilterChange={onFilterChange}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          sidebarOpen={sidebarOpen}
          onOpenSettings={onOpenSettings}
        />
        {children}
      </div>
    </div>
  );
}
