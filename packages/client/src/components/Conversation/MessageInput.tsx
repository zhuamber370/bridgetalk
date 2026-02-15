import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2 } from 'lucide-react';

export interface MessageInputProps {
  /** 消息提交回调 */
  onSubmit: (text: string) => void | Promise<void>;
  /** placeholder 文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 最大字符数 */
  maxLength?: number;
}

/**
 * 重构后的消息输入框
 * 
 * 改进点：
 * 1. 更大的发送按钮（48px，符合拇指操作）
 * 2. 支持多行输入（Shift+Enter换行）
 * 3. 字数统计和限制提示
 * 4. 更好的视觉反馈
 */
export function MessageInput({
  onSubmit,
  placeholder = '输入消息...',
  disabled = false,
  maxLength = 2000,
}: MessageInputProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

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
    // Shift+Enter: 换行
    if (e.key === 'Enter' && e.shiftKey) {
      return;
    }

    // Enter: 发送
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = input.length;
  const isNearLimit = charCount > maxLength * 0.9;
  const isOverLimit = charCount > maxLength;

  return (
    <div
      className="shrink-0 border-t border-[var(--color-border)] bg-white px-4 py-4"
      style={{ paddingBottom: 'calc(16px + var(--safe-area-bottom))' }}
    >
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              if (e.target.value.length <= maxLength) {
                setInput(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || sending}
            rows={1}
            className="w-full rounded-2xl border border-[var(--color-border)] px-5 py-4 text-[16px] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] disabled:bg-[var(--color-slate-100)] disabled:cursor-not-allowed resize-none min-h-[52px] max-h-[140px] leading-relaxed transition-all"
            style={{ borderRadius: 'var(--radius-xl)' }}
          />
          
          {/* 字数统计 */}
          {charCount > 0 && (
            <div className={`absolute right-4 bottom-3 text-[12px] transition-colors ${
              isOverLimit 
                ? 'text-[var(--color-error)]' 
                : isNearLimit 
                  ? 'text-[var(--color-warning)]' 
                  : 'text-[var(--color-text-muted)]'
            }`}>
              {charCount}/{maxLength}
            </div>
          )}
        </div>

        <motion.button
          onClick={handleSubmit}
          disabled={!input.trim() || sending || disabled || isOverLimit}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="shrink-0 w-14 h-14 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          {sending ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Send className="w-6 h-6 ml-0.5" />
          )}
        </motion.button>
      </div>

      {/* 提示文字 */}
      <div className="flex items-center justify-between mt-3 px-1">
        <span className="text-[12px] text-[var(--color-text-muted)]">
          Shift + Enter 换行
        </span>
      </div>
    </div>
  );
}
