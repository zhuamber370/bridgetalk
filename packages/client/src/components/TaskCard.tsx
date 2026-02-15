import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { Task } from '@openclaw/shared';
import { useAppState } from '../lib/store';
import { deleteTask } from '../lib/api';

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
    pending: { label: '待处理', className: 'bg-gray-100 text-gray-600' },
    running: { label: '进行中', className: 'bg-blue-100 text-blue-600' },
    completed: { label: '已完成', className: 'bg-green-100 text-green-600' },
    failed: { label: '失败', className: 'bg-red-100 text-red-600' },
    waiting: { label: '等待中', className: 'bg-yellow-100 text-yellow-600' },
    cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-500' },
  };

  const { label, className } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
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

  // 如果找不到父任务但有 parentTaskId，说明是跨 agent 查询，默认为 PM
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
    // 子任务卡片 - 左侧橙色边框 + 浅橙背景
    return (
      <div className="relative border-l-4 border-amber-400 bg-amber-50 rounded-r-lg mb-3 hover:bg-amber-100 transition-colors group">
        <Link to={`/agents/${task.agentId}/tasks/${task.id}`} className="block p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-amber-800">
            由 {parentAgentName} 委派
          </span>
        </div>

        <div className="text-base font-medium text-gray-900 mb-2">{task.title}</div>

          <div className="flex items-center justify-between text-xs">
            <StatusBadge status={task.status} />
            <div className="flex items-center gap-3 text-gray-600">
              <span>{formatTime(task.updatedAt)}</span>
              {parentTask && (
                <span className="text-amber-600 hover:underline">
                  → 主任务
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* 删除按钮 */}
        {onDelete && (
          <button
            onClick={handleDelete}
            className="absolute top-3 right-3 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
            title={showDeleteConfirm ? '确认删除？' : '删除任务'}
          >
            <svg className={`w-4 h-4 ${showDeleteConfirm ? 'text-red-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // 顶层任务卡片 - 正常样式
  return (
    <div className="relative bg-white rounded-lg mb-3 border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all group">
      <Link to={`/agents/${task.agentId}/tasks/${task.id}`} className="block p-4">
        <div className="text-base font-medium text-gray-900 mb-2">{task.title}</div>

        <div className="flex items-center justify-between text-xs">
          <StatusBadge status={task.status} />
          <span className="text-gray-500">{formatTime(task.updatedAt)}</span>
        </div>
      </Link>

      {/* 删除按钮 */}
      {onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-3 right-3 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
          title={showDeleteConfirm ? '确认删除？' : '删除任务'}
        >
          <svg className={`w-4 h-4 ${showDeleteConfirm ? 'text-red-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
