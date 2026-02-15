import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Button, Textarea } from '../ui';

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
 * 消息输入框 - 使用统一组件库
 *
 * 改进点：
 * 1. 使用 UI 组件库（Button + Textarea）
 * 2. 统一的视觉样式和尺寸
 * 3. 完整的可访问性支持
 * 4. 优化的性能（移除 Framer Motion）
 */
export function MessageInput({
  onSubmit,
  placeholder,
  disabled = false,
  maxLength = 2000,
}: MessageInputProps) {
  const { t } = useTranslation();
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
      console.error(t('errors.sendMessageFailed'), err);
      setInput(text);
    } finally {
      setSending(false);
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

    // Enter: 发送
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="shrink-0 border-t border-[var(--color-border)] bg-white px-4 py-4"
      style={{ paddingBottom: 'calc(16px + var(--safe-area-bottom))' }}
      role="region"
      aria-label={t('message.inputPlaceholder')}
    >
      <div className="flex items-end gap-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('message.inputPlaceholder')}
          disabled={disabled || sending}
          autoResize
          showCount
          maxLength={maxLength}
          aria-label={t('message.messageContent')}
          aria-describedby="message-input-hint"
        />

        <Button
          onClick={handleSubmit}
          disabled={!input.trim() || sending || disabled}
          loading={sending}
          size="lg"
          icon
          aria-label={t('message.send')}
        >
          <Send className="w-6 h-6" style={{ marginLeft: '2px' }} />
        </Button>
      </div>

      <div className="flex items-center justify-between mt-3 px-1">
        <span
          id="message-input-hint"
          className="text-[12px] text-[var(--color-text-muted)]"
        >
          {t('message.shiftEnterToNewLine')}
        </span>
      </div>
    </div>
  );
}
