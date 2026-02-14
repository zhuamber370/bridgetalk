import { useEffect, useRef } from 'react';
import type { Message, Task } from '@openclaw/shared';
import { MessageBubble } from './MessageBubble';
import { TaskCard } from './TaskCard';

interface ChatAreaProps {
  messages: Message[];
  task: Task | null;
  onCancel?: () => void;
  onRetry?: () => void;
}

export function ChatArea({ messages, task, onCancel, onRetry }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center px-8">
          <div className="text-4xl mb-4">👋</div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">欢迎使用 OpenClaw Agent</h2>
          <p className="text-sm text-gray-400">在下方输入您想做的事，Agent 会为您执行</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-3">
      <div className="max-w-3xl mx-auto">
        {/* Task card at the top */}
        <TaskCard task={task} onCancel={onCancel} onRetry={onRetry} />

        {/* Messages */}
        <div className="mt-3">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
