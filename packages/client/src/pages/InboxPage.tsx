import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, useDispatch } from '../lib/store';
import { createTask, listTasks, deleteTask } from '../lib/api';
import { TaskItem } from '../components/TaskItem';
import type { TaskStatus } from '@openclaw/shared';

type FilterTab = 'all' | 'active' | 'waiting' | 'done';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'waiting', label: '需回复' },
  { key: 'done', label: '已完成' },
];

function matchesFilter(status: TaskStatus, filter: FilterTab): boolean {
  switch (filter) {
    case 'all': return true;
    case 'active': return status === 'pending' || status === 'running';
    case 'waiting': return status === 'waiting';
    case 'done': return status === 'completed' || status === 'failed' || status === 'cancelled';
  }
}

export function InboxPage() {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const { tasks, messagesByTask } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Load tasks on mount
  useEffect(() => {
    listTasks()
      .then((data) => dispatch({ type: 'SET_TASKS', tasks: data }))
      .catch(console.error);
  }, [dispatch]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const task = await createTask(text);
      dispatch({ type: 'ADD_TASK', task });
      setInput('');
    } catch (err) {
      console.error('创建任务失败:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Filter + sort by updatedAt descending, waiting tasks pinned to top
  const filteredTasks = tasks.filter((t) => matchesFilter(t.status, filter));
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // waiting 状态置顶
    if (a.status === 'waiting' && b.status !== 'waiting') return -1;
    if (b.status === 'waiting' && a.status !== 'waiting') return 1;
    return b.updatedAt - a.updatedAt;
  });

  // 获取每个任务的最后一条消息预览
  const getLastMessage = (taskId: string): string | undefined => {
    const msgs = messagesByTask[taskId];
    if (!msgs || msgs.length === 0) return undefined;
    const last = msgs[msgs.length - 1];
    return last.content.slice(0, 50);
  };

  // 各筛选的计数
  const counts = {
    all: tasks.length,
    active: tasks.filter((t) => t.status === 'pending' || t.status === 'running').length,
    waiting: tasks.filter((t) => t.status === 'waiting').length,
    done: tasks.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled').length,
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white">
        <h1 className="text-lg font-semibold text-gray-900">OpenClaw Inbox</h1>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="派个任务..."
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || sending}
          className="shrink-0 px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          发送
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b bg-white overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === tab.key
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`ml-1 ${filter === tab.key ? 'text-indigo-500' : 'text-gray-400'}`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">
              {filter === 'all' ? '还没有任务，输入您想做的事开始吧' : '没有符合条件的任务'}
            </p>
          </div>
        ) : (
          sortedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              lastMessage={getLastMessage(task.id)}
              onClick={() => navigate(`/tasks/${task.id}`)}
              onDelete={async () => {
                await deleteTask(task.id);
                dispatch({ type: 'REMOVE_TASK', id: task.id });
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
