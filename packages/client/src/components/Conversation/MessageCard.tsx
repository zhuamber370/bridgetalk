import type { Message } from '@openclaw/shared';

export interface MessageCardProps {
  message: Message;
}

/**
 * 消息卡片（非气泡式，传统消息列表样式）
 */
export function MessageCard({ message }: MessageCardProps) {
  const isUser = message.senderType === 'user';
  const isSystem = message.senderType === 'system';
  const isAgent = message.senderType === 'agent';

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 系统消息（居中显示）
  if (isSystem || message.messageType === 'coordination') {
    return (
      <div className="flex justify-center my-3">
        <div
          className="px-3 py-1.5 rounded-lg text-xs text-amber-800 bg-amber-100 border border-amber-200 max-w-md text-center"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  // 用户消息（右对齐，靛蓝色）
  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fade-in-up">
        <div className="flex flex-col items-end max-w-[80%]">
          <div
            className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <span className="text-xs text-gray-400 mt-1">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  // Agent 消息（左对齐，白色卡片）
  if (isAgent) {
    return (
      <div className="flex justify-start mb-4 animate-fade-in-up">
        <div className="flex gap-3 max-w-[80%]">
          {/* Agent 头像 */}
          <div className="shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-700">
            AI
          </div>

          {/* 消息内容 */}
          <div className="flex flex-col">
            <div
              className="px-4 py-2.5 rounded-lg bg-white border border-gray-200"
              style={{
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
            <span className="text-xs text-gray-400 mt-1">
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 其他类型消息（降级显示）
  return (
    <div className="flex justify-start mb-4">
      <div className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm max-w-[80%]">
        {message.content}
      </div>
    </div>
  );
}
