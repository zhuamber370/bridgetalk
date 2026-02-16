import { forwardRef, TextareaHTMLAttributes, useEffect, useRef } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Whether to auto-resize height */
  autoResize?: boolean;
  /** Minimum height (px) */
  minHeight?: number;
  /** Maximum height (px) */
  maxHeight?: number;
  /** Whether to show character count */
  showCount?: boolean;
  /** Maximum character count */
  maxLength?: number;
}

/**
 * Unified multi-line input component
 *
 * Features:
 * 1. Auto height adjustment
 * 2. Character count (optional)
 * 3. Unified visual style
 * 4. Complete accessibility support
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      autoResize = false,
      minHeight = 52,
      maxHeight = 140,
      showCount = false,
      maxLength,
      className = '',
      value,
      onChange,
      ...props
    },
    forwardedRef
  ) => {
    const localRef = useRef<HTMLTextAreaElement>(null);
    const ref = (forwardedRef as any) || localRef;

    // Auto-adjust height
    useEffect(() => {
      if (autoResize && ref.current) {
        ref.current.style.height = 'auto';
        const newHeight = Math.min(
          Math.max(ref.current.scrollHeight, minHeight),
          maxHeight
        );
        ref.current.style.height = `${newHeight}px`;
      }
    }, [value, autoResize, minHeight, maxHeight, ref]);

    const charCount = typeof value === 'string' ? value.length : 0;
    const isNearLimit = maxLength && charCount > maxLength * 0.9;
    const isOverLimit = maxLength && charCount > maxLength;

    return (
      <div className="relative w-full">
        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          className={`
            w-full
            px-5 py-4
            bg-white
            border-2 border-[var(--color-border)]
            rounded-xl
            text-[var(--font-md)]
            leading-relaxed
            resize-none
            transition-all duration-200
            placeholder:text-[var(--color-text-muted)]
            hover:border-[var(--color-slate-300)]
            focus:border-[var(--color-primary)]
            focus:ring-4 focus:ring-[var(--color-primary-light)]
            disabled:bg-[var(--color-slate-100)]
            disabled:cursor-not-allowed
            disabled:text-[var(--color-text-muted)]
            ${className}
          `.trim().replace(/\s+/g, ' ')}
          style={{
            minHeight: `${minHeight}px`,
            maxHeight: autoResize ? `${maxHeight}px` : undefined,
          }}
          {...props}
        />

        {/* Character count */}
        {showCount && maxLength && charCount > 0 && (
          <div
            className={`
              absolute right-4 bottom-3
              text-[12px] font-medium
              transition-colors duration-200
              pointer-events-none
              ${
                isOverLimit
                  ? 'text-[var(--color-error)]'
                  : isNearLimit
                  ? 'text-[var(--color-warning)]'
                  : 'text-[var(--color-text-muted)]'
              }
            `.trim().replace(/\s+/g, ' ')}
          >
            {charCount}/{maxLength}
          </div>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
