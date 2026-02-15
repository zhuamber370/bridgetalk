import { useState } from 'react';
import { useAppState, useDispatch } from '../../lib/store';
import { createTask, deleteTask } from '../../lib/api';
import { TaskCardCompact } from './TaskCardCompact';
import { QuickTaskInput } from './QuickTaskInput';
import { AgentSwitcher } from '../Sidebar/AgentSwitcher';
import { ShowOn } from '../Layout';
import type { TaskStatus, Task } from '@openclaw/shared';

export interface TaskInboxPanelProps {
  /** 当前 Agent ID */
  agentId: string;
  /** 任务点击回调 */
  onTaskClick?: (task: Task) => void;
  /** 是否显示 Agent 切换器（Tablet/Mobile）*/
  showAgentSwitcher?: boolean;
}

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

/**
 * 任务 Inbox 面板（中间栏）
 */
export function TaskInboxPanel({
  agentId,
  onTaskClick,
  showAgentSwitcher = false,
}: TaskInboxPanelProps) {
  const { tasks, messagesByTask, agents, ui } = useAppState();
  const dispatch = useDispatch();
  const [filter, setFilter] = useState<FilterTab>('all');

  const agent = agents.find((a) => a.id === agentId);

  // 过滤当前 Agent 的任务
  const agentTasks = tasks.filter((t) => t.agentId === agentId);

  // 应用过滤器
  const filteredTasks = agentTasks.filter((t) => matchesFilter(t.status, filter));

  // 排序：waiting 优先，然后按更新时间
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === 'waiting' && b.status !== 'waiting') return -1;
    if (b.status === 'waiting' && a.status !== 'waiting') return 1;
    return b.updatedAt - a.updatedAt;
  });

  // 获取最后一条消息预览
  const getLastMessage = (taskId: string): string | undefined => {
    const msgs = messagesByTask[taskId];
    if (!msgs || msgs.length === 0) return undefined;
    const last = msgs[msgs.length - 1];
    return last.content.slice(0, 50);
  };

  // 统计各状态任务数
  const counts = {
    all: agentTasks.length,
    active: agentTasks.filter((t) => t.status === 'pending' || t.status === 'running').length,
    waiting: agentTasks.filter((t) => t.status === 'waiting').length,
    done: agentTasks.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled').length,
  };

  // 新建任务
  const handleCreateTask = async (text: string) => {
    try {
      const task = await createTask(text, agentId);
      dispatch({ type: 'ADD_TASK', task });
    } catch (err) {
      console.error('创建任务失败:', err);
      throw err;
    }
  };

  // 删除任务
  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      dispatch({ type: 'REMOVE_TASK', id: taskId });
    } catch (err) {
      console.error('删除任务失败:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b bg-white">
        {showAgentSwitcher ? (
          <AgentSwitcher currentAgentId={agentId} />
        ) : (
          <>
            <h1 className="text-lg font-semibold text-gray-900 truncate flex-1">
              {agent?.name ?? agentId}
            </h1>
            {agent?.description && (
              <p className="text-xs text-gray-500 truncate">
                {agent.description}
              </p>
            )}
          </>
        )}
      </div>

      {/* 快速新建输入框 */}
      <QuickTaskInput
        onSubmit={handleCreateTask}
        placeholder="快速新建任务..."
      />

      {/* Filter tabs */}
      <div className="shrink-0 flex gap-1 px-4 py-2 border-b bg-white overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === tab.key
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            style={{ borderRadius: 'var(--radius-full)' }}
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
      <div className="flex-1 overflow-y-auto p-3">
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">
              {filter === 'all' ? '还没有任务，在上方快速创建一个吧' : '没有符合条件的任务'}
            </p>
          </div>
        ) : (
          sortedTasks.map((task) => (
            <TaskCardCompact
              key={task.id}
              task={task}
              isActive={ui.currentTaskId === task.id}
              onClick={() => {
                dispatch({ type: 'SET_CURRENT_TASK', taskId: task.id });
                onTaskClick?.(task);
              }}
              onDelete={handleDeleteTask}
              lastMessagePreview={getLastMessage(task.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
