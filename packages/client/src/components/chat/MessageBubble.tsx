import type { Message } from '@openclaw/shared';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender.type === 'user';
  const isSystem = message.sender.type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <span className="text-xs text-gray-400 ml-1 mb-0.5 block">
            {message.sender.name || 'Agent'}
          </span>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
            isUser
              ? 'bg-indigo-500 text-white rounded-br-md'
              : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md shadow-sm'
          }`}
        >
          {message.content}
        </div>
        <span className={`text-[10px] text-gray-300 mt-0.5 block ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
