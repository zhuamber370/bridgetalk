import type { Agent } from '@openclaw/shared';

interface AgentCardProps {
  agent: Agent;
  taskCount: number;
  onClick: () => void;
}

export function AgentCard({ agent, taskCount, onClick }: AgentCardProps) {
  return (
    <div
      onClick={onClick}
      className="relative flex flex-col gap-2 p-4 rounded-xl border border-gray-200 bg-white cursor-pointer active:bg-gray-50 hover:border-indigo-300 transition-colors"
    >
      {/* Header: name + badge */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-indigo-600">
            {agent.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="font-medium text-sm text-gray-900 truncate flex-1">
          {agent.name}
        </span>
        {agent.id === 'main' && (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600">
            默认
          </span>
        )}
      </div>

      {/* Description */}
      {agent.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{agent.description}</p>
      )}

      {/* Model tag */}
      {agent.model && (
        <span className="text-[10px] text-gray-400 truncate">
          {agent.model}
        </span>
      )}

      {/* Footer: task count */}
      <span className="text-xs text-gray-400">
        {taskCount} 个任务
      </span>
    </div>
  );
}
