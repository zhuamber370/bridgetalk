import type { ReactNode } from 'react';
import { useResponsive } from '../../lib/hooks';

export interface ThreeColumnLayoutProps {
  /** 左侧边栏（Desktop 显示，Agent 列表）*/
  sidebar?: ReactNode;
  /** 侧边栏是否折叠 */
  sidebarCollapsed?: boolean;
  /** 中间栏（任务列表）*/
  inbox: ReactNode;
  /** 右侧栏（对话/详情）*/
  content?: ReactNode;
  /** 底部导航（Mobile 显示）*/
  bottomNav?: ReactNode;
}

/**
 * 三栏响应式布局
 * - Desktop (≥1024px): 三栏并排（Sidebar + Inbox + Content）
 * - Tablet (768-1023px): 两栏（Inbox + Content，Sidebar 折叠为下拉）
 * - Mobile (<768px): 单栏（堆叠，底部导航）
 */
export function ThreeColumnLayout({
  sidebar,
  sidebarCollapsed = false,
  inbox,
  content,
  bottomNav,
}: ThreeColumnLayoutProps) {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  // Mobile: 单栏堆叠布局 + 底部导航
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

  // Tablet: 两栏布局（Inbox + Content）
  if (isTablet) {
    return (
      <div className="flex h-full">
        {/* 任务列表栏 */}
        <div className="w-[400px] shrink-0 border-r bg-white overflow-hidden">
          {inbox}
        </div>

        {/* 内容栏 */}
        {content && (
          <div className="flex-1 overflow-hidden bg-white">
            {content}
          </div>
        )}
      </div>
    );
  }

  // Desktop: 三栏布局（Sidebar + Inbox + Content）
  if (isDesktop) {
    return (
      <div className="flex h-full">
        {/* Agent 侧边栏 */}
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

        {/* 任务列表栏 */}
        <div className="w-80 shrink-0 border-r bg-white overflow-hidden">
          {inbox}
        </div>

        {/* 内容栏 */}
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
