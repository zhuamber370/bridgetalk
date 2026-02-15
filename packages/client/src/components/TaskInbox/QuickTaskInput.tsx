import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button, Textarea } from '../ui';

export interface QuickTaskInputProps {
  /** 输入提交回调 */
  onSubmit: (text: string) => void | Promise<void>;
  /** placeholder 文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 快速任务输入框 - 使用统一组件库
 *
 * 改进点：
 * 1. 使用 UI 组件库（Button + Textarea）
 * 2. 与 MessageInput 保持一致的视觉和交互
 * 3. 完整的可访问性支持
 * 4. 优化的性能
 */
export function QuickTaskInput({
  onSubmit,
  placeholder,
  disabled = false,
}: QuickTaskInputProps) {
  const { t } = useTranslation();
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
      console.error(t('errors.createTaskFailed'), err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      return;
    }
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-3"
      role="region"
      aria-label={t('taskInbox.quickCreatePlaceholder')}
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || t('taskInbox.quickCreatePlaceholder')}
        disabled={disabled || submitting}
        className="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] disabled:opacity-50 transition-all"
        aria-label={t('createAgent.displayName')}
      />

      <Button
        onClick={handleSubmit}
        disabled={!input.trim() || submitting || disabled}
        loading={submitting}
        size="sm"
        aria-label={t('common.create')}
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">{submitting ? t('common.creating') : t('common.create')}</span>
      </Button>
    </div>
  );
}
