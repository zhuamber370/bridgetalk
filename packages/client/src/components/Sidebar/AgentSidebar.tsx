import { useState } from 'react';
import { useAppState, useDispatch } from '../../lib/store';
import { useNavigate } from 'react-router-dom';
import { CreateAgentModal } from '../CreateAgentModal';
import type { Agent } from '@openclaw/shared';

export interface AgentSidebarProps {
  /** 是否折叠（显示图标模式）*/
  collapsed?: boolean;
  /** 折叠切换回调 */
  onToggleCollapse?: () => void;
}

/**
 * Agent 侧边栏（Desktop 左侧）
 * 显示所有 Agent，支持折叠/展开
 */
export function AgentSidebar({ collapsed = false, onToggleCollapse }: AgentSidebarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { agents, tasks, ui } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // 计算每个 Agent 的未读任务数（waiting 状态）
  const getUnreadCount = (agentId: string) => {
    return tasks.filter((t) => t.agentId === agentId && t.status === 'waiting').length;
  };

  const handleSelectAgent = (agent: Agent) => {
    dispatch({ type: 'SET_CURRENT_AGENT', agentId: agent.id });
    dispatch({ type: 'SET_CURRENT_TASK', taskId: null }); // 清空任务选择
    navigate(`/agents/${agent.id}`);
  };

  const handleCreateAgent = () => {
    setShowCreateModal(true);
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        {!collapsed && (
          <h2 className="text-sm font-semibold">Agents</h2>
        )}
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors"
          title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? (
              <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
            ) : (
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            )}
          </svg>
        </button>
      </div>

      {/* Agent 列表 */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {agents.map((agent) => {
          const isActive = ui.currentAgentId === agent.id;
          const unreadCount = getUnreadCount(agent.id);

          return (
            <button
              key={agent.id}
              onClick={() => handleSelectAgent(agent)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors group relative ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-slate-700 text-slate-300'
              }`}
              title={collapsed ? agent.name : undefined}
            >
              {/* 活跃指示器（左侧边框）*/}
              {isActive && (
                <div className="absolute left-0 top-1 bottom-1 w-1 bg-white rounded-r" />
              )}

              {/* Agent 头像 */}
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                isActive ? 'bg-indigo-500' : 'bg-slate-600'
              }`}>
                {agent.name.slice(0, 1).toUpperCase()}
              </div>

              {/* Agent 名称 + 未读徽章 */}
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="text-sm font-medium truncate">
                    {agent.name}
                  </span>
                  {unreadCount > 0 && (
                    <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isActive
                        ? 'bg-white text-indigo-600'
                        : 'bg-indigo-500 text-white'
                    }`}>
                      {unreadCount}
                    </span>
                  )}
                </div>
              )}

              {/* 折叠模式下的未读徽章（右上角） */}
              {collapsed && unreadCount > 0 && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* 新建 Agent 按钮 */}
      <div className="shrink-0 p-4 border-t border-slate-700">
        <button
          onClick={handleCreateAgent}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {!collapsed && <span>新建 Agent</span>}
        </button>
      </div>

      {/* 新建 Agent 模态框 */}
      <CreateAgentModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}
