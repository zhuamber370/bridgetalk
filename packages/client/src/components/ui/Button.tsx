import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button size */
  size?: 'sm' | 'md' | 'lg' | 'icon';
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Whether loading */
  loading?: boolean;
  /** Whether is icon button (circular) */
  icon?: boolean;
}

/**
 * Unified button component
 *
 * Design principles:
 * 1. Unified sizing system (sm/md/lg/icon)
 * 2. Clear visual hierarchy (primary/secondary/ghost)
 * 3. Mobile-friendly (≥44px touch target)
 * 4. Refined interaction feedback
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      size = 'md',
      variant = 'primary',
      loading = false,
      icon = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    // Size mapping
    const sizeClasses = {
      sm: icon ? 'w-9 h-9' : 'px-4 py-2 text-[14px]',
      md: icon ? 'w-11 h-11' : 'px-5 py-3 text-[15px]',
      lg: icon ? 'w-14 h-14' : 'px-6 py-4 text-[16px]',
      icon: 'w-11 h-11', // 默认图标尺寸
    };

    // Variant mapping
    const variantClasses = {
      primary:
        'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-dark)] shadow-md hover:shadow-lg',
      secondary:
        'bg-white text-[var(--color-text)] border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] shadow-sm',
      ghost:
        'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-slate-100)] hover:text-[var(--color-text)]',
      danger:
        'bg-[var(--color-error)] text-white hover:bg-[var(--color-error-dark)] shadow-md',
    };

    const baseClasses = `
      inline-flex items-center justify-center gap-2
      font-medium
      transition-all duration-200
      disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2
      ${icon ? 'rounded-full' : 'rounded-xl'}
      ${sizeClasses[size]}
      ${variantClasses[variant]}
      ${className}
    `.trim().replace(/\s+/g, ' ');

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={baseClasses}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {!icon && <span>加载中...</span>}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
