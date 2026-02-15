import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';

export interface QuickTaskInputProps {
  /** 输入提交回调 */
  onSubmit: (text: string) => void | Promise<void>;
  /** placeholder 文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 重构后的快速新建任务输入框
 * 
 * 改进点：
 * 1. 使用textarea代替input，支持多行
 * 2. 更大的尺寸
 * 3. 自动调整高度
 * 4. 更好的视觉设计
 */
export function QuickTaskInput({
  onSubmit,
  placeholder = '快速新建任务...',
  disabled = false,
}: QuickTaskInputProps) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
    if (!text || submitting || disabled) return;

    setSubmitting(true);
    try {
      await onSubmit(text);
      setInput('');
      // 重置高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('新建任务失败:', err);
    } finally {
      setSubmitting(false);
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

  return (
    <div className="flex items-start gap-4 px-5 py-5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || submitting}
        rows={1}
        className="flex-1 bg-white rounded-xl border-2 border-[var(--color-border)] px-5 py-4 text-[16px] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] disabled:bg-[var(--color-slate-100)] disabled:cursor-not-allowed transition-all resize-none min-h-[56px] max-h-[120px] leading-relaxed"
        style={{ borderRadius: 'var(--radius-lg)' }}
      />
      
      <motion.button
        onClick={handleSubmit}
        disabled={!input.trim() || submitting || disabled}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="shrink-0 px-6 py-4 bg-[var(--color-primary)] text-white rounded-xl text-[15px] font-semibold hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
        style={{ borderRadius: 'var(--radius-lg)' }}
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>创建中</span>
          </>
        ) : (
          <>
            <Plus className="w-5 h-5" />
            <span>创建</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
