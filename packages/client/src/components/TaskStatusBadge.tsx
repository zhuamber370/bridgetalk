import type { TaskStatus } from '@openclaw/shared';

const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: '等待中', color: 'bg-gray-200 text-gray-700' },
  running: { label: '执行中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
  waiting: { label: '等待回复', color: 'bg-yellow-100 text-yellow-700' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.pending;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}
