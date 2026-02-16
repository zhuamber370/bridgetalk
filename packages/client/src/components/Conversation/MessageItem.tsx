import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, CoordinationData, Agent } from '@bridgetalk/shared';
import { useAppState } from '../../lib/store';

export interface MessageItemProps {
  message: Message;
  /** Display mode: compact/comfortable */
  variant?: 'compact' | 'comfortable';
  /** Whether to show avatar (comfortable mode only) */
  showAvatar?: boolean;
  /** Whether is grouped message (same sender as previous) */
  isGrouped?: boolean;
}

/**
 * Unified message component (iMessage style)
 *
 * Improvements:
 * 1. Merge MessageCard and MessageBubble
 * 2. Adopt iMessage-style layout
 * 3. Support consecutive message grouping
 * 4. Better visual hierarchy
 * 5. Larger size, better readability
 */
export function MessageItem({
  message,
  variant = 'comfortable',
  showAvatar = true,
  isGrouped = false,
}: MessageItemProps) {
  const { agents } = useAppState();

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAgentName = (agentId: string): string => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name || agentId;
  };

  const getAgentColor = (agentId: string): string => {
    // Use CSS variables instead of hardcoded colors
    const colors = [
      'var(--color-info)',       // Blue
      'var(--color-success)',    // Emerald
      'var(--color-primary)',    // Violet
      'var(--color-warning)',    // Amber
      'var(--color-error)',      // Rose
      'var(--color-delegated)',  // Cyan
    ];
    let hash = 0;
    for (let i = 0; i < agentId.length; i++) {
      hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // System/coordination messages (centered display)
  if (message.senderType === 'system' || message.messageType === 'coordination') {
    let content = message.content;

    // Try to parse coordination message
    if (message.messageType === 'coordination') {
      try {
        const data = JSON.parse(message.content) as CoordinationData;
        content = renderCoordinationText(data, agents);
      } catch {
        // Parse failed, use original content
      }
    }

    return (
      <div
        className="flex justify-center my-4 animate-fade-in"
        role="status"
        aria-live="polite"
      >
        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--color-warning-light)] border border-[var(--color-warning)]/20 max-w-[90%]">
          <span className="text-[13px] text-[var(--color-warning-dark)] font-medium text-center">
            {content}
          </span>
        </div>
      </div>
    );
  }

  const isUser = message.senderType === 'user';
  const isAgent = message.senderType === 'agent';

  // User messages (right-aligned)
  if (isUser) {
    return (
      <div
        className={`flex justify-end ${isGrouped ? 'mt-2' : 'mt-5'} ${!isGrouped ? 'animate-fade-in-up' : ''}`}
        role="article"
        aria-label={`你发送的消息: ${message.content}`}
      >
        <div className="flex flex-col items-end max-w-[85%]">
          {/* Avatar (only show in comfortable mode when not grouped) */}
          {variant === 'comfortable' && showAvatar && !isGrouped && (
            <div className="flex items-center gap-2 mb-2 mr-1">
              <span className="text-[13px] text-[var(--color-text-muted)]">
                你
              </span>
              <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            </div>
          )}

          {/* Message bubble */}
          <div
            className="px-5 py-3.5 rounded-2xl bg-[var(--color-primary)] text-white text-[16px] leading-relaxed"
            style={{
              borderRadius: isGrouped ? '20px 20px 4px 20px' : '20px 4px 20px 20px',
              wordBreak: 'break-word',
            }}
          >
            {message.content}
          </div>

          {/* Timestamp */}
          {!isGrouped && (
            <span className="text-[12px] text-[var(--color-text-muted)] mt-1.5 mr-1">
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Agent messages (left-aligned)
  if (isAgent) {
    const agentName = message.senderAgentId
      ? getAgentName(message.senderAgentId)
      : 'AI';
    const agentColor = message.senderAgentId
      ? getAgentColor(message.senderAgentId)
      : 'var(--color-slate-400)';

    return (
      <div
        className={`flex justify-start ${isGrouped ? 'mt-2' : 'mt-5'} ${!isGrouped ? 'animate-fade-in-up' : ''}`}
        role="article"
        aria-label={`${agentName}的回复: ${message.content}`}
      >
        <div className="flex gap-3 max-w-[90%]">
          {/* Avatar */}
          {variant === 'comfortable' && showAvatar && !isGrouped && (
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: agentColor }}
                aria-hidden="true"
              >
                <Bot className="w-5 h-5 text-white" />
              </div>
            </div>
          )}

          {/* Message content */}
          <div className="flex flex-col">
            {/* Agent name (only show when not grouped) */}
            {!isGrouped && (
              <span className="text-[13px] text-[var(--color-text-muted)] mb-1.5 ml-1">
                {agentName}
              </span>
            )}

            {/* 消息气泡 */}
            <div
              className="px-5 py-3.5 rounded-2xl bg-white border border-[var(--color-border)] text-[var(--color-text)] text-[16px] leading-relaxed shadow-sm markdown-content"
              style={{
                borderRadius: isGrouped ? '4px 20px 20px 20px' : '20px 20px 20px 4px',
                wordBreak: 'break-word',
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>

            {/* 时间戳 */}
            {!isGrouped && (
              <span className="text-[12px] text-[var(--color-text-muted)] mt-1.5 ml-1">
                {formatTime(message.timestamp)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Other message types (fallback display)
  return (
    <div className="flex justify-start mt-5 animate-fade-in" role="article">
      <div className="px-5 py-3.5 rounded-2xl bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-[16px] max-w-[85%]">
        {message.content}
      </div>
    </div>
  );
}

// Helper function: render coordination message text
function renderCoordinationText(data: CoordinationData, agents: Agent[]): string {
  const getName = (id: string) => {
    const agent = agents.find((a) => a.id === id);
    return agent?.name || id;
  };

  switch (data.type) {
    case 'team_created':
      return `${getName(data.from)} 创建了协作团队`;
    case 'task_delegated':
      return data.to
        ? `${getName(data.from)} → ${getName(data.to)}: ${data.summary}`
        : `${getName(data.from)}: ${data.summary}`;
    case 'agent_reply':
      return `${getName(data.to || '')} 汇报: ${data.summary}`;
    case 'result_merged':
      return `${getName(data.from)} 整合了团队结果`;
    default:
      return data.summary;
  }
}

/**
 * Message list component (handles grouping logic)
 */
export interface MessageListProps {
  messages: Message[];
  variant?: 'compact' | 'comfortable';
}

export function MessageList({ messages, variant = 'comfortable' }: MessageListProps) {
  return (
    <div className="space-y-0">
      {messages.map((message, index) => {
        // Check if consecutive message (same sender as previous)
        const prevMessage = index > 0 ? messages[index - 1] : undefined;
        const isGrouped = Boolean(
          prevMessage &&
          prevMessage.senderType === message.senderType &&
          prevMessage.senderAgentId === message.senderAgentId &&
          message.timestamp - prevMessage.timestamp < 60000
        ); // Within 1 minute

        return (
          <MessageItem
            key={message.id}
            message={message}
            variant={variant}
            isGrouped={isGrouped}
          />
        );
      })}
    </div>
  );
}
