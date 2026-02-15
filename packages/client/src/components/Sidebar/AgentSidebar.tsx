import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, Bot, Sparkles, Globe } from 'lucide-react';
import { useAppState, useDispatch } from '../../lib/store';
import { useNavigate } from 'react-router-dom';
import { CreateAgentModal } from '../CreateAgentModal';
import type { Agent } from '@bridgetalk/shared';

export interface AgentSidebarProps {
  /** 是否折叠（显示图标模式）*/
  collapsed?: boolean;
  /** 折叠切换回调 */
  onToggleCollapse?: () => void;
}

/**
 * 改进的Agent侧边栏
 * 
 * 改进点：
 * 1. 提升信息密度 - 显示更多有用信息
 * 2. 动画效果 - 平滑的展开/收起
 * 3. 视觉层次 - 更清晰的active状态
 * 4. 空状态优化 - 无Agent时的引导
 */
export function AgentSidebar({ collapsed = false, onToggleCollapse }: AgentSidebarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const { agents, tasks, ui } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // 计算每个Agent的统计数据
  const getAgentStats = (agentId: string) => {
    const agentTasks = tasks.filter((t) => t.agentId === agentId);
    const unreadCount = agentTasks.filter((t) => t.status === 'waiting').length;
    const activeCount = agentTasks.filter((t) => t.status === 'pending' || t.status === 'running').length;
    
    // 最后活跃时间
    const lastTask = agentTasks.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const lastActive = lastTask ? formatLastActive(lastTask.updatedAt) : null;
    
    return { unreadCount, activeCount, lastActive };
  };

  // Format last active time
  const formatLastActive = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('time.justNow');
    if (minutes < 60) return t('time.minutesAgo', { count: minutes });
    if (hours < 24) return t('time.hoursAgo', { count: hours });
    if (days < 7) return t('time.daysAgo', { count: days });
    return t('time.longAgo');
  };

  const handleSelectAgent = (agent: Agent) => {
    dispatch({ type: 'SET_CURRENT_AGENT', agentId: agent.id });
    dispatch({ type: 'SET_CURRENT_TASK', taskId: null });
    navigate(`/agents/${agent.id}`);
  };

  const handleCreateAgent = () => {
    setShowCreateModal(true);
  };

  // 生成Agent头像背景色（基于名称哈希）
  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-emerald-500',
      'bg-violet-500',
      'bg-amber-500',
      'bg-rose-500',
      'bg-cyan-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-slate-700)]">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <Bot className="w-5 h-5 text-[var(--color-primary-light)]" />
              <h2 className="text-sm font-semibold text-white whitespace-nowrap">Agents</h2>
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.button
          onClick={onToggleCollapse}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-sidebar-hover)] transition-colors shrink-0"
          title={collapsed ? t('pages.agentInbox.expandSidebar') : t('pages.agentInbox.collapseSidebar')}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </motion.button>
      </div>

      {/* Agent列表 */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {agents.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
            <Sparkles className="w-8 h-8 text-[var(--color-slate-500)] mb-2" />
            {!collapsed && (
              <p className="text-xs text-[var(--color-slate-400)]">
                {t('pages.agentInbox.noAgents')}
                <br />
                {t('pages.agentInbox.createAgentHint')}
              </p>
            )}
          </div>
        ) : (
          agents.map((agent, index) => {
            const isActive = ui.currentAgentId === agent.id;
            const stats = getAgentStats(agent.id);
            const avatarColor = getAvatarColor(agent.name);

            return (
              <motion.button
                key={agent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSelectAgent(agent)}
                onMouseEnter={() => setHoveredAgent(agent.id)}
                onMouseLeave={() => setHoveredAgent(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white shadow-md'
                    : 'hover:bg-[var(--color-sidebar-hover)] text-[var(--color-slate-300)]'
                }`}
                title={collapsed ? agent.name : undefined}
              >
                {/* 活跃指示器（左侧边框）*/}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
                  />
                )}

                {/* Agent头像 */}
                <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                  isActive ? 'bg-white/20 text-white' : avatarColor
                }`}>
                  {agent.name.slice(0, 1).toUpperCase()}
                </div>

                {/* Agent信息（展开状态）*/}
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 flex flex-col items-start min-w-0 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className={`text-sm font-medium truncate ${
                          isActive ? 'text-white' : 'text-white'
                        }`}>
                          {agent.name}
                        </span>
                        
                        {/* 未读徽章 */}
                        {stats.unreadCount > 0 && (
                          <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-white text-[var(--color-primary)]'
                              : 'bg-[var(--color-primary)] text-white'
                          }`}>
                            {stats.unreadCount}
                          </span>
                        )}
                      </div>
                      
                      {/* Status info */}
                      <span className={`text-[11px] truncate ${
                        isActive ? 'text-white/70' : 'text-[var(--color-slate-400)]'
                      }`}>
                        {stats.activeCount > 0
                          ? t('pages.agentInbox.activeTasks', { count: stats.activeCount })
                          : stats.lastActive || t('pages.agentInbox.noActivity')}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 折叠模式下的未读徽章（右上角）*/}
                {collapsed && stats.unreadCount > 0 && (
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--color-error)] rounded-full flex items-center justify-center text-[10px] font-bold">
                    {stats.unreadCount > 9 ? '9+' : stats.unreadCount}
                  </div>
                )}

                {/* Hover tooltip (collapsed mode) */}
                {collapsed && hoveredAgent === agent.id && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-[var(--color-slate-800)] text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg border border-[var(--color-slate-700)]">
                    <div className="font-medium">{agent.name}</div>
                    {stats.unreadCount > 0 && (
                      <div className="text-[var(--color-error)]">{t('pages.agentInbox.unreadCount', { count: stats.unreadCount })}</div>
                    )}
                  </div>
                )}
              </motion.button>
            );
          })
        )}
      </div>

      {/* Create Agent Button */}
      <div className="shrink-0 p-4 border-t border-[var(--color-slate-700)]">
        <motion.button
          onClick={handleCreateAgent}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[15px] font-semibold transition-colors shadow-lg ${
            collapsed ? 'px-3 py-3' : ''
          }`}
        >
          <Plus className="w-5 h-5 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap overflow-hidden"
              >
                {t('pages.agentInbox.createAgentButton')}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Language Switcher */}
      <div className="shrink-0 px-4 pb-4">
        <LanguageSwitcher collapsed={collapsed} />
      </div>

      {/* Create Agent Modal */}
      <CreateAgentModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}

// Language Switcher Component
function LanguageSwitcher({ collapsed }: { collapsed: boolean }) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggleLanguage = () => {
    const newLang = currentLang === 'zh-CN' ? 'en' : 'zh-CN';
    i18n.changeLanguage(newLang);
  };

  return (
    <motion.button
      onClick={toggleLanguage}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-slate-700)] hover:bg-[var(--color-slate-600)] text-white/80 text-[13px] font-medium transition-colors ${
        collapsed ? 'px-2' : 'px-4'
      }`}
    >
      <Globe className="w-4 h-4 shrink-0" />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="whitespace-nowrap overflow-hidden"
          >
            {currentLang === 'zh-CN' ? '中文' : 'English'}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
