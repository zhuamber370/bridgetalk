import type { Message, CoordinationData, Agent } from '@bridgetalk/shared';
import { useAppState } from '../lib/store';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getAgentName(agentId: string, agents: Agent[]): string {
  const agent = agents.find(a => a.id === agentId);
  return agent?.name || agentId;
}

function renderCoordinationText(data: CoordinationData, agents: Agent[]): string {
  const fromName = getAgentName(data.from, agents);
  const toName = data.to ? getAgentName(data.to, agents) : '';

  switch (data.type) {
    case 'team_created':
      return `${fromName} 创建了协作团队`;
    case 'task_delegated':
      return `${fromName} → ${toName}: ${data.summary}`;
    case 'agent_reply':
      return `${toName} 汇报: ${data.summary}`;
    case 'result_merged':
      return `${fromName} 整合了团队结果`;
    default:
      return data.summary;
  }
}

export function MessageBubble({ message }: { message: Message }) {
  const { agents } = useAppState();

  // 协调消息特殊渲染（居中黄色标签）
  if (message.messageType === 'coordination') {
    try {
      const coordData = JSON.parse(message.content) as CoordinationData;
      return (
        <div className="flex justify-center my-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            <span>{renderCoordinationText(coordData, agents)}</span>
          </div>
        </div>
      );
    } catch {
      // 解析失败，降级为普通消息
    }
  }

  // 常规消息（用户/agent）
  const isUser = message.senderType === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-500 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        {/* 如果是 agent 消息且有 senderAgentId，显示来源标签 */}
        {message.senderType === 'agent' && message.senderAgentId && (
          <div className="text-[10px] text-gray-500 mb-1 font-medium">
            {getAgentName(message.senderAgentId, agents)}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div
          className={`text-[10px] mt-1 ${
            isUser ? 'text-indigo-200' : 'text-gray-400'
          }`}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}
