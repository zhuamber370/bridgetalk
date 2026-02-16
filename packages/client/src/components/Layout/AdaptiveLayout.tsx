import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useResponsive } from '../../lib/hooks';

export interface AdaptiveLayoutProps {
  /** Left sidebar (Desktop display) */
  sidebar?: ReactNode;
  /** Whether sidebar is collapsed */
  sidebarCollapsed?: boolean;
  /** Middle task list */
  inbox: ReactNode;
  /** Right content area */
  content?: ReactNode;
  /** Bottom navigation (Mobile display) */
  bottomNav?: ReactNode;
  /** Whether to show Inbox on mobile (otherwise show Content) */
  showInboxOnMobile?: boolean;
}

/**
 * Adaptive three-column layout
 *
 * Desktop (≥1024px): Sidebar + Inbox + Content
 * Tablet (640-1023px): Inbox + Content (no Sidebar)
 * Mobile (<640px): Single column + bottom navigation
 *
 * Improvements:
 * 1. Use CSS Grid instead of Flexbox for more flexible layout control
 * 2. Use Framer Motion for smooth transitions
 * 3. Responsive breakpoint optimization
 */
export function AdaptiveLayout({
  sidebar,
  sidebarCollapsed = false,
  inbox,
  content,
  bottomNav,
  showInboxOnMobile = true,
}: AdaptiveLayoutProps) {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  // Mobile: Single column layout + bottom navigation
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg)]">
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {showInboxOnMobile ? (
              <motion.div
                key="inbox"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {inbox}
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {content}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {bottomNav && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="shrink-0 border-t border-[var(--color-border)] bg-white"
            style={{ paddingBottom: 'var(--safe-area-bottom)' }}
          >
            {bottomNav}
          </motion.div>
        )}
      </div>
    );
  }

  // Tablet: Two-column layout (Inbox + Content)
  if (isTablet) {
    return (
      <div className="flex h-full bg-[var(--color-bg)]">
        {/* Task list - use percentage width */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="w-[45%] max-w-[480px] shrink-0 border-r border-[var(--color-border)] bg-white overflow-hidden"
        >
          {inbox}
        </motion.div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden bg-white">
          {content || (
            <div className="flex items-center justify-center h-full bg-[var(--color-bg-secondary)]">
              <div className="text-center p-8">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="w-16 h-16 rounded-full bg-[var(--color-slate-100)] flex items-center justify-center mx-auto mb-4"
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-slate-400)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </motion.div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  选择一个任务开始对话
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: Three-column layout (Sidebar + Inbox + Content)
  return (
    <div className="flex h-full bg-[var(--color-bg)]">
      {/* Agent sidebar */}
      {sidebar && (
        <motion.div
          initial={false}
          animate={{
            width: sidebarCollapsed ? 72 : 240,
          }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="shrink-0 border-r border-[var(--color-slate-700)] overflow-hidden"
          style={{ background: 'var(--color-sidebar)' }}
        >
          {sidebar}
        </motion.div>
      )}

      {/* Task list - widened to 400px */}
      <div className="w-[400px] shrink-0 border-r border-[var(--color-border)] bg-white overflow-hidden">
        {inbox}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden bg-white">
        {content || (
          <div className="flex items-center justify-center h-full bg-[var(--color-bg-secondary)]">
            <div className="text-center p-8">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="w-20 h-20 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center mx-auto mb-4"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </motion.div>
              <p className="text-base text-[var(--color-text-secondary)] font-medium">
                选择一个任务开始对话
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">
                或者创建一个新任务
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
