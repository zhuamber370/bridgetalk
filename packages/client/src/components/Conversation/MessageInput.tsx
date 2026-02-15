import { useState } from 'react';

export interface MessageInputProps {
  /** 消息提交回调 */
  onSubmit: (text: string) => void | Promise<void>;
  /** placeholder 文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 底部消息输入框
 */
export function MessageInput({
  onSubmit,
  placeholder = '继续对话...',
  disabled = false,
}: MessageInputProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || sending || disabled) return;

    setSending(true);
    setInput('');

    try {
      await onSubmit(text);
    } catch (err) {
      console.error('发送消息失败:', err);
      setInput(text); // 恢复输入
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter: 换行
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      return;
    }

    // Enter: 发送（非输入法状态）
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="shrink-0 flex items-center gap-2 px-4 py-3 border-t bg-white"
      style={{ paddingBottom: 'calc(12px + var(--safe-area-bottom))' }}
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || sending}
        className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
        style={{ borderRadius: 'var(--radius-xl)' }}
      />
      <button
        onClick={handleSubmit}
        disabled={!input.trim() || sending || disabled}
        className="shrink-0 w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {sending ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        )}
      </button>
    </div>
  );
}
