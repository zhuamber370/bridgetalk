import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppState, useDispatch } from '../lib/store';
import { listTasks, getAgent, getTask } from '../lib/api';
import { useResponsive } from '../lib/hooks';
import { ThreeColumnLayout } from '../components/Layout';
import { AgentSidebar, BottomNav } from '../components/Sidebar';
import { TaskInboxPanel } from '../components/TaskInbox';
import { ConversationPanel } from '../components/Conversation';
import { CreateAgentModal } from '../components/CreateAgentModal';
import type { Task } from '@openclaw/shared';

/**
 * Agent Inbox 页面 - 三栏布局
 * 路由：/agents/:agentId 或 /agents/:agentId/tasks/:taskId
 */
export function AgentInboxPage() {
  const { agentId, taskId } = useParams<{ agentId: string; taskId?: string }>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { agents, ui } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isMobile, isDesktop } = useResponsive();

  // Load agent info
  useEffect(() => {
    if (!agentId) return;

    const cached = agents.find((a) => a.id === agentId);
    if (cached) {
      dispatch({ type: 'SET_CURRENT_AGENT', agentId });
    } else {
      getAgent(agentId)
        .then((agent) => {
          dispatch({ type: 'ADD_AGENT', agent });
          dispatch({ type: 'SET_CURRENT_AGENT', agentId });
        })
        .catch(console.error);
    }
  }, [agentId, agents, dispatch]);

  // Load tasks for this agent + poll every 5s as SSE fallback
  useEffect(() => {
    if (!agentId) return;

    const fetchTasks = () =>
      listTasks(agentId)
        .then((data) => dispatch({ type: 'SET_TASKS', tasks: data }))
        .catch(console.error);

    fetchTasks();
    const timer = setInterval(fetchTasks, 5000);
    return () => clearInterval(timer);
  }, [agentId, dispatch]);

  // Set current task from URL
  useEffect(() => {
    if (taskId) {
      dispatch({ type: 'SET_CURRENT_TASK', taskId });

      // Load task details if needed
      getTask(taskId)
        .then((task) => dispatch({ type: 'ADD_TASK', task }))
        .catch(console.error);
    } else {
      dispatch({ type: 'SET_CURRENT_TASK', taskId: null });
    }
  }, [taskId, dispatch]);

  // 侧边栏折叠控制
  const handleToggleSidebar = () => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  };

  // 任务点击（导航到任务详情）
  const handleTaskClick = (task: Task) => {
    if (isMobile) {
      // Mobile: 导航到新页面
      navigate(`/agents/${agentId}/tasks/${task.id}`);
    } else {
      // Desktop/Tablet: 更新 URL 但保持在同一页面
      navigate(`/agents/${agentId}/tasks/${task.id}`, { replace: true });
    }
  };

  // 返回（清空任务选择）
  const handleBack = () => {
    navigate(`/agents/${agentId}`);
  };

  // 没有 Agent 时显示欢迎页
  if (!agentId || agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6" style={{ background: 'var(--color-bg)' }}>
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
          style={{ background: 'var(--color-primary-light)' }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          欢迎使用 OpenClaw
        </h1>
        <p className="text-center mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          创建您的第一个 AI Agent 开始使用
        </p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 rounded-lg text-sm font-medium text-white transition-colors"
          style={{
            background: 'var(--color-primary)',
            borderRadius: 'var(--radius-md)',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-primary-hover)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'var(--color-primary)')}
        >
          新建 Agent
        </button>

        <CreateAgentModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
      </div>
    );
  }

  // Mobile: 根据 taskId 决定显示 Inbox 还是 Conversation
  if (isMobile) {
    if (taskId) {
      return <ConversationPanel taskId={taskId} onBack={handleBack} />;
    }

    return (
      <ThreeColumnLayout
        inbox={<TaskInboxPanel agentId={agentId} onTaskClick={handleTaskClick} showAgentSwitcher />}
        bottomNav={<BottomNav />}
      />
    );
  }

  // Desktop/Tablet: 三栏或两栏布局
  return (
    <ThreeColumnLayout
      sidebar={
        isDesktop ? (
          <AgentSidebar
            collapsed={ui.sidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
          />
        ) : undefined
      }
      sidebarCollapsed={ui.sidebarCollapsed}
      inbox={
        <TaskInboxPanel
          agentId={agentId}
          onTaskClick={handleTaskClick}
          showAgentSwitcher={!isDesktop}
        />
      }
      content={
        taskId ? (
          <ConversationPanel taskId={taskId} onBack={!isDesktop ? handleBack : undefined} />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">选择一个任务开始对话</p>
            </div>
          </div>
        )
      }
    />
  );
}
