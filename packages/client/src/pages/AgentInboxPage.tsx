import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bot, Plus } from 'lucide-react';
import { useAppState, useDispatch } from '../lib/store';
import { listTasks, getAgent, getTask, listAgents } from '../lib/api';
import { useResponsive } from '../lib/hooks';
import { AdaptiveLayout } from '../components/Layout';
import { AgentSidebar, BottomNav } from '../components/Sidebar';
import { TaskInboxPanel } from '../components/TaskInbox';
import { ConversationPanel } from '../components/Conversation';
import { CreateAgentModal } from '../components/CreateAgentModal';
import type { Task } from '@bridgetalk/shared';

/**
 * Agent Inbox 页面 - 使用新的AdaptiveLayout
 */
export function AgentInboxPage() {
  const { agentId, taskId } = useParams<{ agentId: string; taskId?: string }>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { agents, ui } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isMobile, isDesktop } = useResponsive();
  const { t } = useTranslation();

  // Load all agents list on mount
  useEffect(() => {
    listAgents()
      .then((data) => dispatch({ type: 'SET_AGENTS', agents: data }))
      .catch(console.error);
  }, [dispatch]);

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

  // 任务点击
  const handleTaskClick = (task: Task) => {
    if (isMobile) {
      // Mobile: 导航到新页面
      navigate(`/agents/${agentId}/tasks/${task.id}`);
    } else {
      // Desktop/Tablet: 更新 URL
      navigate(`/agents/${agentId}/tasks/${task.id}`, { replace: true });
    }
  };

  // 返回
  const handleBack = () => {
    navigate(`/agents/${agentId}`);
  };

  // 没有 Agent 时显示欢迎页
  if (!agentId || agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8 bg-[var(--color-primary-subtle)]"
          >
            <Bot className="w-12 h-12 text-[var(--color-primary)]" />
          </div>
          
          <h1 className="text-2xl font-bold mb-3 text-[var(--color-text)]">
            {t('pages.welcome.title')}
          </h1>
          
          <p className="text-center mb-8 text-[var(--color-text-secondary)] max-w-sm">
            {t('pages.welcome.subtitle')}
          </p>
          
          <motion.button
            onClick={() => setShowCreateModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-[15px] font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            {t('pages.welcome.createAgent')}
          </motion.button>

          <CreateAgentModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        </motion.div>
      </div>
    );
  }

  return (
    <AdaptiveLayout
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
          <ConversationPanel taskId={taskId} onBack={isMobile ? handleBack : undefined} />
        ) : undefined
      }
      bottomNav={<BottomNav />}
      showInboxOnMobile={!taskId}
    />
  );
}
