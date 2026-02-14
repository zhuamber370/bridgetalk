import type { Task } from '@openclaw/shared';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  activeTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onNewTask: () => void;
  filter: string;
  onFilterChange: (filter: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-400',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-gray-400',
};

const FILTERS = [
  { value: '', label: '全部' },
  { value: 'running,pending', label: '进行中' },
  { value: 'completed', label: '已完成' },
];

export function Sidebar({ open, onClose, tasks, activeTaskId, onSelectTask, onNewTask, filter, onFilterChange }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-white border-r border-gray-200 z-40
          transform transition-transform duration-200 ease-out
          lg:relative lg:translate-x-0 lg:z-10
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
            <span className="font-semibold text-gray-800">Tasks</span>
            <button
              onClick={onNewTask}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 active:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新任务
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-1 px-3 py-2 border-b border-gray-100">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  filter === f.value
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400">
                暂无任务
              </div>
            ) : (
              tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => { onSelectTask(task.id); onClose(); }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    task.id === activeTaskId ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[task.status] || 'bg-gray-300'}`} />
                    <span className="text-sm font-medium text-gray-800 truncate">{task.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400 truncate ml-4">
                    {new Date(task.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
