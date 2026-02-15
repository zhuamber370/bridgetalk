import { motion } from 'framer-motion';
import { GitPullRequest, Clock, Trash2, MoreHorizontal } from 'lucide-react';
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
 * 重构后的紧凑型任务卡片
 * 
 * 改进点：
 * 1. 更好的视觉层次和间距
 * 2. 子任务使用Teal色区分
 * 3. 更明显的active状态
 * 4. 改进的删除交互
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

  // 子任务标识
  const isSubTask = !!task.parentTaskId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`group relative flex flex-col gap-2 py-4 px-4 rounded-xl cursor-pointer transition-all mb-3 border ${
        isActive
          ? 'bg-[var(--color-primary-subtle)] border-[var(--color-primary)] shadow-md'
          : 'bg-white border-[var(--color-border)] hover:border-[var(--color-slate-300)] hover:shadow-sm'
      }`}
    >
      {/* 左侧色条（active状态）*/}
      {isActive && (
        <div className="absolute left-0 top-3 bottom-3 w-1 bg-[var(--color-primary)] rounded-r-full" />
      )}

      {/* 子任务指示器（Teal色）*/}
      {isSubTask && (
        <div className="absolute left-0 top-3 bottom-3 w-1 bg-[var(--color-delegated)] rounded-r-full" />
      )}

      {/* 委派标签 */}
      {isSubTask && (
        <div className="flex items-center gap-1.5 mb-1">
          <GitPullRequest className="w-3.5 h-3.5 text-[var(--color-delegated)]" />
          <span className="text-[11px] font-medium text-[var(--color-delegated-dark)]">
            委派任务
          </span>
        </div>
      )}

      {/* 标题 + 状态 */}
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`text-[15px] font-semibold leading-snug line-clamp-2 flex-1 ${
            isActive ? 'text-[var(--color-primary-dark)]' : 'text-[var(--color-text)]'
          }`}
        >
          {task.title}
        </h3>
        <div className="shrink-0 pt-0.5">
          <TaskStatusBadge status={task.status} />
        </div>
      </div>

      {/* 消息预览 */}
      {lastMessagePreview && (
        <p className="text-[13px] text-[var(--color-text-secondary)] line-clamp-1 leading-relaxed">
          {lastMessagePreview}
        </p>
      )}

      {/* 底部信息 */}
      <div className="flex items-center justify-between text-[12px] text-[var(--color-text-muted)] mt-1">
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatTime(task.updatedAt)}</span>
        </div>

        {/* 删除按钮（悬停显示）*/}
        {onDelete && (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('确定删除这个任务吗？')) {
                onDelete(task.id);
              }
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-[var(--color-error-light)] text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
