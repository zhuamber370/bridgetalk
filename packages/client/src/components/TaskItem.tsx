import type { Task } from '@bridgetalk/shared';
import { TaskStatusBadge } from './TaskStatusBadge';

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}

interface TaskItemProps {
  task: Task;
  lastMessage?: string;
  onClick: () => void;
  onDelete: () => void;
}

export function TaskItem({ task, lastMessage, onClick, onDelete }: TaskItemProps) {
  return (
    <div className="flex items-center border-b border-gray-100">
      {/* Main content — clickable */}
      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left px-4 py-3 active:bg-gray-50 transition-colors min-h-[64px] flex flex-col gap-1"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm text-gray-900 truncate flex-1">
            {task.title}
          </span>
          <TaskStatusBadge status={task.status} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500 truncate flex-1">
            {lastMessage ?? ''}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {timeAgo(task.updatedAt)}
          </span>
        </div>
      </button>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="shrink-0 w-10 h-10 mr-2 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        title="删除任务"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}
