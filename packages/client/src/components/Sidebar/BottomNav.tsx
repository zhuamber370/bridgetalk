import { useAppState, useDispatch } from '../../lib/store';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Agent } from '@openclaw/shared';

export interface BottomNavProps {
  /** 最多显示的 Agent 数量（超过显示"更多"）*/
  maxAgents?: number;
}

/**
 * 底部导航栏（Mobile）
 * 显示最常用的 Agent 快捷入口 + 更多菜单
 */
export function BottomNav({ maxAgents = 4 }: BottomNavProps) {
  const { agents, tasks, ui } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // 取前 N 个 Agent（按未读数排序）
  const sortedAgents = [...agents]
    .map((agent) => ({
      agent,
      unreadCount: tasks.filter((t) => t.agentId === agent.id && t.status === 'waiting').length,
    }))
    .sort((a, b) => b.unreadCount - a.unreadCount)
    .slice(0, maxAgents)
    .map((item) => item.agent);

  const handleSelectAgent = (agent: Agent) => {
    dispatch({ type: 'SET_CURRENT_AGENT', agentId: agent.id });
    dispatch({ type: 'SET_CURRENT_TASK', taskId: null });
    navigate(`/agents/${agent.id}`);
  };

  const handleGoHome = () => {
    dispatch({ type: 'SET_CURRENT_AGENT', agentId: null });
    navigate('/');
  };

  const isHome = location.pathname === '/';

  return (
    <nav
      className="flex items-center justify-around bg-white border-t border-gray-200"
      style={{ paddingBottom: 'var(--safe-area-bottom)' }}
    >
      {/* 首页 */}
      <button
        onClick={handleGoHome}
        className={`flex flex-col items-center justify-center py-2 px-3 min-w-0 ${
          isHome ? 'text-indigo-600' : 'text-gray-500'
        }`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span className="text-xs mt-1">首页</span>
      </button>

      {/* Agent 快捷入口 */}
      {sortedAgents.map((agent) => {
        const isActive = ui.currentAgentId === agent.id;
        const unreadCount = tasks.filter((t) => t.agentId === agent.id && t.status === 'waiting').length;

        return (
          <button
            key={agent.id}
            onClick={() => handleSelectAgent(agent)}
            className={`flex flex-col items-center justify-center py-2 px-3 min-w-0 relative ${
              isActive ? 'text-indigo-600' : 'text-gray-500'
            }`}
          >
            {/* Agent 头像 */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              isActive ? 'bg-indigo-500 text-white' : 'bg-gray-300 text-gray-700'
            }`}>
              {agent.name.slice(0, 1).toUpperCase()}
            </div>

            {/* 未读徽章 */}
            {unreadCount > 0 && (
              <div className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full" />
            )}

            <span className="text-xs mt-1 truncate max-w-full">
              {agent.name}
            </span>
          </button>
        );
      })}

      {/* 更多 */}
      {agents.length > maxAgents && (
        <button
          onClick={handleGoHome}
          className="flex flex-col items-center justify-center py-2 px-3 min-w-0 text-gray-500"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
          <span className="text-xs mt-1">更多</span>
        </button>
      )}
    </nav>
  );
}
