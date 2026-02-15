import { useState, useRef, useEffect } from 'react';
import { useAppState, useDispatch } from '../../lib/store';
import { useNavigate } from 'react-router-dom';
import type { Agent } from '@openclaw/shared';

export interface AgentSwitcherProps {
  /** 当前选中的 Agent ID */
  currentAgentId?: string | null;
}

/**
 * Agent 下拉选择器（Tablet/Mobile）
 * 用于在不显示侧边栏时快速切换 Agent
 */
export function AgentSwitcher({ currentAgentId }: AgentSwitcherProps) {
  const { agents, tasks } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentAgent = agents.find((a) => a.id === currentAgentId);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectAgent = (agent: Agent) => {
    dispatch({ type: 'SET_CURRENT_AGENT', agentId: agent.id });
    dispatch({ type: 'SET_CURRENT_TASK', taskId: null });
    navigate(`/agents/${agent.id}`);
    setIsOpen(false);
  };

  const getUnreadCount = (agentId: string) => {
    return tasks.filter((t) => t.agentId === agentId && t.status === 'waiting').length;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {/* Agent 头像 */}
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-medium">
          {currentAgent?.name.slice(0, 1).toUpperCase() ?? '?'}
        </div>

        {/* Agent 名称 */}
        <span className="text-sm font-semibold text-gray-900">
          {currentAgent?.name ?? '选择 Agent'}
        </span>

        {/* 下拉图标 */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          {agents.map((agent) => {
            const isActive = agent.id === currentAgentId;
            const unreadCount = getUnreadCount(agent.id);

            return (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agent)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                  isActive ? 'bg-indigo-50' : ''
                }`}
              >
                {/* Agent 头像 */}
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isActive ? 'bg-indigo-500 text-white' : 'bg-gray-300 text-gray-700'
                }`}>
                  {agent.name.slice(0, 1).toUpperCase()}
                </div>

                {/* Agent 信息 */}
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <div className="flex flex-col items-start min-w-0">
                    <span className={`text-sm font-medium truncate ${
                      isActive ? 'text-indigo-700' : 'text-gray-900'
                    }`}>
                      {agent.name}
                    </span>
                    {agent.description && (
                      <span className="text-xs text-gray-500 truncate">
                        {agent.description}
                      </span>
                    )}
                  </div>

                  {/* 未读徽章 */}
                  {unreadCount > 0 && (
                    <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-xs font-semibold">
                      {unreadCount}
                    </span>
                  )}
                </div>

                {/* 选中指示器 */}
                {isActive && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-indigo-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}

          {/* 新建 Agent */}
          <div className="border-t border-gray-200 mt-2 pt-2">
            <button
              onClick={() => {
                navigate('/');
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors text-indigo-600"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="text-sm font-medium">新建 Agent</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
