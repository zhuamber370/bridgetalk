import type { ReactNode } from 'react';
import { useResponsive, type Breakpoint } from '../../lib/hooks';

export interface ResponsiveLayoutProps {
  /** 各断点对应的渲染内容 */
  children: {
    mobile?: ReactNode;
    tablet?: ReactNode;
    desktop?: ReactNode;
    wide?: ReactNode;
  };
  /** 默认回退内容（当对应断点没有指定时） */
  fallback?: ReactNode;
}

/**
 * 响应式布局切换器
 * 根据当前断点渲染不同的内容
 */
export function ResponsiveLayout({ children, fallback }: ResponsiveLayoutProps) {
  const { breakpoint } = useResponsive();

  const content = children[breakpoint] ?? fallback;

  return <>{content}</>;
}

/**
 * 响应式显示组件
 * 只在指定断点显示子元素
 */
export interface ShowOnProps {
  breakpoints: Breakpoint[];
  children: ReactNode;
}

export function ShowOn({ breakpoints, children }: ShowOnProps) {
  const { breakpoint } = useResponsive();

  if (!breakpoints.includes(breakpoint)) {
    return null;
  }

  return <>{children}</>;
}

/**
 * 响应式隐藏组件
 * 在指定断点隐藏子元素
 */
export interface HideOnProps {
  breakpoints: Breakpoint[];
  children: ReactNode;
}

export function HideOn({ breakpoints, children }: HideOnProps) {
  const { breakpoint } = useResponsive();

  if (breakpoints.includes(breakpoint)) {
    return null;
  }

  return <>{children}</>;
}
