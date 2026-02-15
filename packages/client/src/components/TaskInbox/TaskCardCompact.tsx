import { TaskStatusBadge } from '../TaskStatusBadge';
import type { Task } from '@openclaw/shared';

export interface TaskCardCompactProps {
  task: Task;
  isActive?: boolean;
  onClick?: () => void;
  onDelete?: (taskId: string) => void;
  /** 最后一条消息预览 */
  lastMessagePreview?: string;
}

/**
 * 紧凑型任务卡片（用于 Inbox 列表）
 */
export function TaskCardCompact({
  task,
  isActive = false,
  onClick,
  onDelete,
  lastMessagePreview,
}: TaskCardCompactProps) {
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  // 子任务标识（左侧橙色边框）
  const isSubTask = !!task.parentTaskId;

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col gap-2 py-3 px-4 rounded-lg cursor-pointer transition-all mb-2 ${
        isActive
          ? 'bg-blue-50 border-2 border-blue-300'
          : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
      } ${isSubTask ? 'border-l-4 border-l-orange-400' : ''}`}
      style={!isActive ? { boxShadow: 'var(--shadow-sm)' } : undefined}
    >
      {/* 子任务标签 */}
      {isSubTask && (
        <div className="flex items-center gap-1 text-xs text-orange-600 mb-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span>委派任务</span>
        </div>
      )}

      {/* 标题 + 状态 */}
      <div className="flex items-start justify-between gap-2">
        <h3 className={`text-sm font-semibold truncate flex-1 ${
          isActive ? 'text-blue-900' : 'text-gray-900'
        }`}>
          {task.title}
        </h3>
        <TaskStatusBadge status={task.status} />
      </div>

      {/* 消息预览 */}
      {lastMessagePreview && (
        <p className="text-xs text-gray-500 truncate">
          {lastMessagePreview}
        </p>
      )}

      {/* 底部信息：时间 */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{formatTime(task.updatedAt)}</span>
      </div>

      {/* 悬停删除按钮 */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="absolute top-2 right-2 w-6 h-6 rounded-md bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          title="删除任务"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
