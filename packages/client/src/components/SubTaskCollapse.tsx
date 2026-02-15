import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Task, Message } from '@openclaw/shared';
import { useAppState } from '../lib/store';
import { MessageBubble } from './MessageBubble';

function StatusBadge({ status }: { status: Task['status'] }) {
  const config = {
    pending: { label: '待处理', className: 'bg-gray-100 text-gray-600' },
    running: { label: '进行中', className: 'bg-blue-100 text-blue-600' },
    completed: { label: '✅ 已完成', className: 'bg-green-100 text-green-600' },
    failed: { label: '❌ 失败', className: 'bg-red-100 text-red-600' },
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

export function SubTaskCollapse({ task }: { task?: Task }) {
  const [expanded, setExpanded] = useState(false);
  const { messagesByTask, agents } = useAppState();

  if (!task) return null;

  const subMessages = messagesByTask[task.id] || [];
  const agent = agents.find(a => a.id === task.agentId);

  return (
    <div className="my-3 border border-amber-200 rounded-lg overflow-hidden">
      {/* 折叠标题 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-amber-50 flex items-center justify-between hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="font-medium text-amber-900">
            {agent?.name || task.agentId} 工作过程
          </span>
          <StatusBadge status={task.status} />
        </div>
        <svg
          className={`w-5 h-5 text-amber-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="bg-white p-4 border-t border-amber-200">
          {subMessages.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">
              暂无消息
            </div>
          ) : (
            subMessages.map((msg: Message) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
          <div className="mt-3 text-xs text-gray-500 text-right">
            <Link
              to={`/agents/${task.agentId}/tasks/${task.id}`}
              className="text-amber-600 hover:underline"
            >
              查看完整对话 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
