import type { TaskStatus } from '@bridgetalk/shared';
import { useTranslation } from 'react-i18next';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  MinusCircle 
} from 'lucide-react';

const statusConfig: Record<
  TaskStatus,
  {
    labelKey: string;
    bgColor: string;
    textColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: {
    labelKey: 'status.pending',
    bgColor: 'bg-[var(--color-slate-100)]',
    textColor: 'text-[var(--color-slate-600)]',
    icon: Clock,
  },
  running: {
    labelKey: 'status.running',
    bgColor: 'bg-[var(--color-info-light)]',
    textColor: 'text-[var(--color-info-dark)]',
    icon: Loader2,
  },
  completed: {
    labelKey: 'status.completed',
    bgColor: 'bg-[var(--color-success-light)]',
    textColor: 'text-[var(--color-success-dark)]',
    icon: CheckCircle2,
  },
  failed: {
    labelKey: 'status.failed',
    bgColor: 'bg-[var(--color-error-light)]',
    textColor: 'text-[var(--color-error-dark)]',
    icon: XCircle,
  },
  waiting: {
    labelKey: 'status.waiting',
    bgColor: 'bg-[var(--color-warning-light)]',
    textColor: 'text-[var(--color-warning-dark)]',
    icon: AlertCircle,
  },
  cancelled: {
    labelKey: 'status.cancelled',
    bgColor: 'bg-[var(--color-slate-100)]',
    textColor: 'text-[var(--color-slate-400)]',
    icon: MinusCircle,
  },
};

export interface TaskStatusBadgeProps {
  status: TaskStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export function TaskStatusBadge({ 
  status, 
  showIcon = true,
  size = 'sm' 
}: TaskStatusBadgeProps) {
  const { t } = useTranslation();
  const cfg = statusConfig[status] ?? statusConfig.pending;
  const Icon = cfg.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${cfg.bgColor} ${cfg.textColor} ${sizeClasses[size]}`}
    >
      {showIcon && status === 'running' ? (
        <Icon className={`${iconSizes[size]} animate-spin`} />
      ) : showIcon ? (
        <Icon className={iconSizes[size]} />
      ) : null}
      <span>{t(cfg.labelKey)}</span>
    </span>
  );
}
