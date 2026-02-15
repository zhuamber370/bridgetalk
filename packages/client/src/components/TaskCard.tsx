import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitPullRequest, Trash2, ExternalLink } from 'lucide-react';
import type { Task } from '@bridgetalk/shared';
import { useAppState } from '../lib/store';

function formatTime(ts: number, t: any): string {
  const now = Date.now();
  const diff = now - ts;

  if (diff < 60000) return t('time.justNow');
  if (diff < 3600000) return t('time.minutesAgo', { count: Math.floor(diff / 60000) });
  if (diff < 86400000) return t('time.hoursAgo', { count: Math.floor(diff / 3600000) });
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function StatusBadge({ status, t }: { status: Task['status']; t: any }) {
  const config = {
    pending: { key: 'status.pending', className: 'bg-[var(--color-slate-100)] text-[var(--color-slate-600)]' },
    running: { key: 'status.running', className: 'bg-[var(--color-info-light)] text-[var(--color-info-dark)]' },
    completed: { key: 'status.completed', className: 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]' },
    failed: { key: 'status.failed', className: 'bg-[var(--color-error-light)] text-[var(--color-error-dark)]' },
    waiting: { key: 'status.waiting', className: 'bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]' },
    cancelled: { key: 'status.cancelled', className: 'bg-[var(--color-slate-100)] text-[var(--color-slate-400)]' },
  };

  const { key, className } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}>
      {t(key)}
    </span>
  );
}

interface TaskCardProps {
  task: Task;
  onDelete?: (taskId: string) => void;
}

export function TaskCard({ task, onDelete }: TaskCardProps) {
  const { t } = useTranslation();
  const { tasks, agents } = useAppState();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isSubTask = !!task.parentTaskId;
  const parentTask = isSubTask ? tasks.find(t => t.id === task.parentTaskId) : null;
  const parentAgent = parentTask ? agents.find(a => a.id === parentTask.agentId) : null;
  const parentAgentName = parentAgent?.name || (task.parentTaskId ? 'PM' : t('common.unknown'));

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
              {t('taskInbox.delegatedBy', { agentName: parentAgentName })}
            </span>
          </div>

          <div className="text-[15px] font-semibold text-[var(--color-text)] mb-2 leading-snug">
            {task.title}
          </div>

          <div className="flex items-center justify-between text-[12px]">
            <StatusBadge status={task.status} t={t} />
            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
              <span>{formatTime(task.updatedAt, t)}</span>
              {parentTask && (
                <span className="text-[var(--color-delegated)] flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  {t('taskInbox.parentTask')}
                </span>
              )}
            </div>
          </div>
        </Link>

        {onDelete && (
          <motion.button
            onClick={handleDelete}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--color-error-light)] transition-all"
            title={showDeleteConfirm ? t('common.confirmDelete') : t('common.deleteTask')}
          >
            <Trash2 className={`w-4 h-4 ${showDeleteConfirm ? 'text-[var(--color-error)]' : 'text-[var(--color-text-muted)]'}`} />
          </motion.button>
        )}
      </motion.div>
    );
  }

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
          <StatusBadge status={task.status} t={t} />
          <span className="text-[var(--color-text-muted)]">{formatTime(task.updatedAt, t)}</span>
        </div>
      </Link>

      {onDelete && (
        <motion.button
          onClick={handleDelete}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--color-error-light)] transition-all"
          title={showDeleteConfirm ? t('common.confirmDelete') : t('common.deleteTask')}
        >
          <Trash2 className={`w-4 h-4 ${showDeleteConfirm ? 'text-[var(--color-error)]' : 'text-[var(--color-text-muted)]'}`} />
        </motion.button>
      )}
    </motion.div>
  );
}
