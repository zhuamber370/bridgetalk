import { useState } from 'react';

export interface QuickTaskInputProps {
  /** 输入提交回调 */
  onSubmit: (text: string) => void | Promise<void>;
  /** placeholder 文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 快速新建任务输入框（inline）
 */
export function QuickTaskInput({
  onSubmit,
  placeholder = '快速新建任务...',
  disabled = false,
}: QuickTaskInputProps) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || submitting || disabled) return;

    setSubmitting(true);
    try {
      await onSubmit(text);
      setInput('');
    } catch (err) {
      console.error('新建任务失败:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || submitting}
        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
        style={{ borderRadius: 'var(--radius-md)' }}
      />
      <button
        onClick={handleSubmit}
        disabled={!input.trim() || submitting || disabled}
        className="shrink-0 px-3 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        {submitting ? '...' : '创建'}
      </button>
    </div>
  );
}
