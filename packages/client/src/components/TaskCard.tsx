import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { GitPullRequest, Trash2, ExternalLink } from 'lucide-react';
import type { Task } from '@openclaw/shared';
import { useAppState } from '../lib/store';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function StatusBadge({ status }: { status: Task['status'] }) {
  const config = {
    pending: { label: '待处理', className: 'bg-[var(--color-slate-100)] text-[var(--color-slate-600)]' },
    running: { label: '进行中', className: 'bg-[var(--color-info-light)] text-[var(--color-info-dark)]' },
    completed: { label: '已完成', className: 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]' },
    failed: { label: '失败', className: 'bg-[var(--color-error-light)] text-[var(--color-error-dark)]' },
    waiting: { label: '等待中', className: 'bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]' },
    cancelled: { label: '已取消', className: 'bg-[var(--color-slate-100)] text-[var(--color-slate-400)]' },
  };

  const { label, className } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}

interface TaskCardProps {
  task: Task;
  onDelete?: (taskId: string) => void;
}

export function TaskCard({ task, onDelete }: TaskCardProps) {
  const { tasks, agents } = useAppState();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 判断是否为子任务
  const isSubTask = !!task.parentTaskId;
  const parentTask = isSubTask ? tasks.find(t => t.id === task.parentTaskId) : null;
  const parentAgent = parentTask ? agents.find(a => a.id === parentTask.agentId) : null;
  const parentAgentName = parentAgent?.name || (task.parentTaskId ? 'PM' : '未知');

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showDeleteConfirm) {
      onDelete?.(task.id);
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  if (isSubTask) {
    // 子任务卡片 - Teal色主题
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        className="relative border-l-4 border-[var(--color-delegated)] bg-[var(--color-delegated-light)]/30 rounded-r-xl mb-3 hover:bg-[var(--color-delegated-light)]/50 transition-colors group"
      >
        <Link to={`/agents/${task.agentId}/tasks/${task.id}`} className="block p-4">
          <div className="flex items-center gap-2 mb-2">
            <GitPullRequest className="w-4 h-4 text-[var(--color-delegated)]" />
            <span className="text-[13px] font-medium text-[var(--color-delegated-dark)]">
              由 {parentAgentName} 委派
            </span>
          </div>

          <div className="text-[15px] font-semibold text-[var(--color-text)] mb-2 leading-snug">
            {task.title}
          </div>

          <div className="flex items-center justify-between text-[12px]">
            <StatusBadge status={task.status} />
            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
              <span>{formatTime(task.updatedAt)}</span>
              {parentTask && (
                <span className="text-[var(--color-delegated)] flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  主任务
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* 删除按钮 */}
        {onDelete && (
          <motion.button
            onClick={handleDelete}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--color-error-light)] transition-all"
            title={showDeleteConfirm ? '确认删除？' : '删除任务'}
          >
            <Trash2 className={`w-4 h-4 ${showDeleteConfirm ? 'text-[var(--color-error)]' : 'text-[var(--color-text-muted)]'}`} />
          </motion.button>
        )}
      </motion.div>
    );
  }

  // 顶层任务卡片
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className="relative bg-white rounded-xl mb-3 border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-md transition-all group"
    >
      <Link to={`/agents/${task.agentId}/tasks/${task.id}`} className="block p-4">
        <div className="text-[15px] font-semibold text-[var(--color-text)] mb-2 leading-snug">
          {task.title}
        </div>

        <div className="flex items-center justify-between text-[12px]">
          <StatusBadge status={task.status} />
          <span className="text-[var(--color-text-muted)]">{formatTime(task.updatedAt)}</span>
        </div>
      </Link>

      {/* 删除按钮 */}
      {onDelete && (
        <motion.button
          onClick={handleDelete}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--color-error-light)] transition-all"
          title={showDeleteConfirm ? '确认删除？' : '删除任务'}
        >
          <Trash2 className={`w-4 h-4 ${showDeleteConfirm ? 'text-[var(--color-error)]' : 'text-[var(--color-text-muted)]'}`} />
        </motion.button>
      )}
    </motion.div>
  );
}
