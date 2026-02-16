import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Button, Textarea } from '../ui';

export interface MessageInputProps {
  /** Message submit callback */
  onSubmit: (text: string) => void | Promise<void>;
  /** Placeholder text */
  placeholder?: string;
  /** Whether disabled */
  disabled?: boolean;
  /** Maximum character count */
  maxLength?: number;
}

/**
 * Message input component - Using unified component library
 *
 * Improvements:
 * 1. Use UI component library (Button + Textarea)
 * 2. Unified visual style and sizing
 * 3. Complete accessibility support
 * 4. Optimized performance (removed Framer Motion)
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
    // Shift + Enter: new line
    if (e.key === 'Enter' && e.shiftKey) {
      return;
    }

    // Enter: send
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
