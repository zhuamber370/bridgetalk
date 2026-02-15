import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Plus, Grid3X3, Globe } from 'lucide-react';
import { useAppState, useDispatch } from '../../lib/store';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreateAgentModal } from '../CreateAgentModal';
import type { Agent } from '@bridgetalk/shared';

export interface BottomNavProps {
  /** 最多显示的Agent数量（超过显示"更多"）*/
  maxAgents?: number;
}

/**
 * 重构后的底部导航栏
 * 
 * 改进点：
 * 1. 更合理的导航结构
 * 2. 快速新建Agent入口
 * 3. Agent列表弹窗
 * 4. 更好的视觉反馈
 */
export function BottomNav({ maxAgents = 4 }: BottomNavProps) {
  const [showAgentList, setShowAgentList] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { agents, tasks, ui } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  // 按未读数排序Agent
  const sortedAgents = [...agents]
    .map((agent) => ({
      agent,
      unreadCount: tasks.filter((t) => t.agentId === agent.id && t.status === 'waiting').length,
    }))
    .sort((a, b) => b.unreadCount - a.unreadCount);

  const displayedAgents = sortedAgents.slice(0, maxAgents);
  const hasMoreAgents = sortedAgents.length > maxAgents;

  const handleSelectAgent = (agent: Agent) => {
    dispatch({ type: 'SET_CURRENT_AGENT', agentId: agent.id });
    dispatch({ type: 'SET_CURRENT_TASK', taskId: null });
    navigate(`/agents/${agent.id}`);
    setShowAgentList(false);
  };

  const handleGoHome = () => {
    dispatch({ type: 'SET_CURRENT_AGENT', agentId: null });
    navigate('/');
  };

  const isHome = location.pathname === '/';
  const isAgentPage = location.pathname.startsWith('/agents/');

  // 生成Agent头像背景色
  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-emerald-500',
      'bg-violet-500',
      'bg-amber-500',
      'bg-rose-500',
      'bg-cyan-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <>
      <nav
        className="flex items-center justify-around bg-white border-t border-[var(--color-border)] px-2"
        style={{ paddingBottom: 'var(--safe-area-bottom)' }}
      >
        {/* Home */}
        <NavButton
          active={isHome}
          onClick={handleGoHome}
          icon={<Home className="w-5 h-5" />}
          label={t('pages.agentInbox.home')}
        />

        {/* Agent快捷入口 */}
        {displayedAgents.map(({ agent, unreadCount }) => {
          const isActive = ui.currentAgentId === agent.id;

          return (
            <NavButton
              key={agent.id}
              active={isActive}
              onClick={() => handleSelectAgent(agent)}
              avatar={agent.name.slice(0, 1).toUpperCase()}
              avatarColor={getAvatarColor(agent.name)}
              label={agent.name}
              badge={unreadCount > 0 ? unreadCount : undefined}
            />
          );
        })}

        {/* 更多Agent / Agent列表 */}
        {hasMoreAgents || agents.length === 0 ? (
          <NavButton
            active={showAgentList}
            onClick={() => setShowAgentList(!showAgentList)}
            icon={<Grid3X3 className="w-5 h-5" />}
            label="Agents"
          />
        ) : null}

        {/* Language Switcher */}
        <NavButton
          active={false}
          onClick={() => {
            const newLang = currentLang === 'zh-CN' ? 'en' : 'zh-CN';
            i18n.changeLanguage(newLang);
          }}
          icon={<Globe className="w-5 h-5" />}
          label={currentLang === 'zh-CN' ? '中文' : 'EN'}
        />
      </nav>

      {/* Agent列表弹窗 */}
      <AnimatePresence>
        {showAgentList && (
          <>
            {/* 遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAgentList(false)}
              className="fixed inset-0 bg-black/30 z-40"
            />

            {/* 弹窗 */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[70vh] overflow-hidden"
              style={{ paddingBottom: 'var(--safe-area-bottom)' }}
            >
              {/* 拖动条 */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-[var(--color-slate-300)] rounded-full" />
              </div>

              {/* Title */}
              <div className="px-5 pb-3 border-b border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-bold text-[var(--color-text)]">
                    {t('pages.agentInbox.selectAgent')}
                  </h3>
                  <motion.button
                    onClick={() => setShowCreateModal(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 text-[13px] text-[var(--color-primary)] font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    {t('pages.agentInbox.create')}
                  </motion.button>
                </div>
              </div>

              {/* Agent列表 */}
              <div className="overflow-y-auto max-h-[50vh]">
                {sortedAgents.map(({ agent, unreadCount }, index) => {
                  const isActive = ui.currentAgentId === agent.id;

                  return (
                    <motion.button
                      key={agent.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleSelectAgent(agent)}
                      className={`w-full flex items-center gap-4 px-5 py-4 border-b border-[var(--color-border)] transition-colors ${
                        isActive ? 'bg-[var(--color-primary-subtle)]' : 'hover:bg-[var(--color-bg-secondary)]'
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-[16px] font-semibold text-white ${getAvatarColor(agent.name)}`}>
                        {agent.name.slice(0, 1).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className={`text-[15px] font-semibold ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                            {agent.name}
                          </span>
                          {isActive && (
                            <span className="text-[11px] bg-[var(--color-primary)] text-white px-1.5 py-0.5 rounded">
                              {t('pages.agentInbox.current')}
                            </span>
                          )}
                        </div>
                        {agent.description && (
                          <p className="text-[12px] text-[var(--color-text-muted)] line-clamp-1 mt-0.5">
                            {agent.description}
                          </p>
                        )}
                      </div>

                      {/* Badge */}
                      {unreadCount > 0 && (
                        <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[var(--color-error)] text-white text-[12px] font-semibold flex items-center justify-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 新建Agent模态框 */}
      <CreateAgentModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </>
  );
}

// 导航按钮组件
interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  avatar?: string;
  avatarColor?: string;
  label: string;
  badge?: number;
}

function NavButton({ active, onClick, icon, avatar, avatarColor, label, badge }: NavButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`flex flex-col items-center justify-center py-2 px-2 min-w-0 flex-1 relative ${
        active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
      }`}
    >
      <div className="relative">
        {avatar ? (
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white ${avatarColor}`}>
            {avatar}
          </div>
        ) : (
          <div className={`w-6 h-6 ${active ? 'text-[var(--color-primary)]' : ''}`}>
            {icon}
          </div>
        )}

        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--color-error)] text-white text-[10px] font-bold flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className={`text-[11px] mt-1 truncate max-w-full ${active ? 'font-medium' : ''}`}>
        {label}
      </span>
    </motion.button>
  );
}
