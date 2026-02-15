import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Plus } from 'lucide-react';
import { useAppState, useDispatch } from '../../lib/store';
import { createTask, deleteTask } from '../../lib/api';
import { TaskCardCompact } from './TaskCardCompact';
import { QuickTaskInput } from './QuickTaskInput';
import { AgentSwitcher } from '../Sidebar/AgentSwitcher';
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
    case 'all':
      return true;
    case 'active':
      return status === 'pending' || status === 'running';
    case 'waiting':
      return status === 'waiting';
    case 'done':
      return status === 'completed' || status === 'failed' || status === 'cancelled';
  }
}

/**
 * 重构后的任务 Inbox 面板
 * 
 * 改进点：
 * 1. 更好的视觉层次
 * 2. 改进的空状态
 * 3. 平滑的过滤切换动画
 * 4. 优化的统计显示
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
    <div className="flex flex-col h-full bg-white"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-4 border-b border-[var(--color-border)] bg-white"
      >
        {showAgentSwitcher ? (
          <AgentSwitcher currentAgentId={agentId} />
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center"
            >
              <span className="text-lg font-bold text-[var(--color-primary)]">
                {agent?.name?.slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0"
            >
              <h1 className="text-[17px] font-bold text-[var(--color-text)] truncate">
                {agent?.name ?? agentId}
              </h1>
              {agent?.description && (
                <p className="text-[12px] text-[var(--color-text-muted)] truncate">
                  {agent.description}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* 快速新建输入框 */}
      <QuickTaskInput
        onSubmit={handleCreateTask}
        placeholder="描述您想要完成的任务..."
      />

      {/* Filter tabs - 增大间距和padding */}
      <div className="shrink-0 flex gap-4 px-6 py-6 border-b-2 border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-x-auto"
      >
        {FILTER_TABS.map((tab) => (
          <motion.button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`shrink-0 px-8 py-4 rounded-full text-[16px] font-semibold transition-colors border-2 ${
              filter === tab.key
                ? 'bg-[var(--color-primary)] text-white shadow-md border-[var(--color-primary)]'
                : 'bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-slate-100)] border-[var(--color-border)]'
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span
                className={`ml-3 ${
                  filter === tab.key ? 'text-white/80' : 'text-[var(--color-text-muted)]'
                }`}
              >
                {counts[tab.key]}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 bg-[var(--color-bg-secondary)]"
      >
        <AnimatePresence mode="wait">
          {sortedTasks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center h-full text-center px-6"
            >
              <div className="w-16 h-16 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center mb-4"
              >
                <Inbox className="w-7 h-7 text-[var(--color-primary)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--color-text-secondary)] mb-1">
                {filter === 'all' ? '还没有任务' : '没有符合条件的任务'}
              </p>
              <p className="text-[13px] text-[var(--color-text-muted)]">
                {filter === 'all'
                  ? '在上方快速创建一个吧'
                  : '尝试切换其他筛选条件'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {sortedTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <TaskCardCompact
                    task={task}
                    isActive={ui.currentTaskId === task.id}
                    onClick={() => {
                      dispatch({ type: 'SET_CURRENT_TASK', taskId: task.id });
                      onTaskClick?.(task);
                    }}
                    onDelete={handleDeleteTask}
                    lastMessagePreview={getLastMessage(task.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
