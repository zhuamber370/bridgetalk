import type { ReactNode } from 'react';
import { useResponsive } from '../../lib/hooks';

export interface ThreeColumnLayoutProps {
  /** Left sidebar (Desktop display, Agent list) */
  sidebar?: ReactNode;
  /** Whether sidebar is collapsed */
  sidebarCollapsed?: boolean;
  /** Middle column (Task list) */
  inbox: ReactNode;
  /** Right column (Conversation/Detail) */
  content?: ReactNode;
  /** Bottom navigation (Mobile display) */
  bottomNav?: ReactNode;
}

/**
 * Three-column responsive layout
 * - Desktop (≥1024px): Three columns side by side (Sidebar + Inbox + Content)
 * - Tablet (768-1023px): Two columns (Inbox + Content, Sidebar collapsed to dropdown)
 * - Mobile (<768px): Single column (stacked, bottom navigation)
 */
export function ThreeColumnLayout({
  sidebar,
  sidebarCollapsed = false,
  inbox,
  content,
  bottomNav,
}: ThreeColumnLayoutProps) {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  // Mobile: Single column stacked layout + bottom navigation
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden">
          {content ?? inbox}
        </div>
        {bottomNav && (
          <div className="shrink-0 border-t bg-white">
            {bottomNav}
          </div>
        )}
      </div>
    );
  }

  // Tablet: Two-column layout (Inbox + Content)
  if (isTablet) {
    return (
      <div className="flex h-full">
        {/* Task list column */}
        <div className="w-[400px] shrink-0 border-r bg-white overflow-hidden">
          {inbox}
        </div>

        {/* Content column */}
        {content && (
          <div className="flex-1 overflow-hidden bg-white">
            {content}
          </div>
        )}
      </div>
    );
  }

  // Desktop: Three-column layout (Sidebar + Inbox + Content)
  if (isDesktop) {
    return (
      <div className="flex h-full">
        {/* Agent sidebar */}
        {sidebar && (
          <div
            className="shrink-0 border-r overflow-hidden transition-all duration-300"
            style={{
              background: 'var(--color-sidebar)',
              width: sidebarCollapsed ? '60px' : '240px',
            }}
          >
            {sidebar}
          </div>
        )}

        {/* Task list column */}
        <div className="w-80 shrink-0 border-r bg-white overflow-hidden">
          {inbox}
        </div>

        {/* Content column */}
        {content && (
          <div className="flex-1 overflow-hidden bg-white">
            {content}
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return <div className="flex h-full">{inbox}</div>;
}
