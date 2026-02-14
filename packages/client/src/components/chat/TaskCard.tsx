import type { Task } from '@openclaw/shared';

interface TaskCardProps {
  task: Task;
  onCancel?: () => void;
  onRetry?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '等待中', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  running: { label: '执行中', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  completed: { label: '已完成', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  failed: { label: '已失败', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  cancelled: { label: '已取消', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
};

export function TaskCard({ task, onCancel, onRetry }: TaskCardProps) {
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;

  return (
    <div className={`mx-2 my-2 p-3 rounded-xl border ${config.bg}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-800 truncate">{task.title}</span>
        <span className={`text-xs font-medium ${config.color} px-2 py-0.5 rounded-full bg-white/60`}>
          {config.label}
        </span>
      </div>

      {task.status === 'running' && (
        <div className="mt-2">
          <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {(task.status === 'running' || task.status === 'pending') && onCancel && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            取消任务
          </button>
        </div>
      )}

      {task.status === 'failed' && onRetry && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={onRetry}
            className="text-xs px-3 py-1 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
