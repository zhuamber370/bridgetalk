import { useEffect } from 'react';

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (event: KeyboardEvent) => void;
  description?: string;
}

/**
 * 快捷键绑定 Hook
 * @param bindings 快捷键绑定配置数组
 * @param enabled 是否启用（默认 true）
 */
export function useKeyboard(bindings: KeyBinding[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const binding of bindings) {
        const ctrlMatch = binding.ctrl ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = binding.meta ? event.metaKey : !event.metaKey;
        const shiftMatch = binding.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = binding.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase();

        // Cmd/Ctrl 通用处理（macOS 用 Cmd，Windows/Linux 用 Ctrl）
        const cmdCtrlMatch =
          (binding.ctrl || binding.meta) &&
          (event.ctrlKey || event.metaKey) &&
          !binding.shift &&
          !binding.alt;

        if (keyMatch && (cmdCtrlMatch || (ctrlMatch && metaMatch && shiftMatch && altMatch))) {
          event.preventDefault();
          binding.handler(event);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [bindings, enabled]);
}

/**
 * 全局快捷键预定义
 */
export const globalKeyBindings = {
  // Cmd/Ctrl + K: 快速搜索
  quickSearch: (handler: () => void): KeyBinding => ({
    key: 'k',
    meta: true,
    handler,
    description: '快速搜索任务',
  }),

  // Cmd/Ctrl + N: 新建任务
  newTask: (handler: () => void): KeyBinding => ({
    key: 'n',
    meta: true,
    handler,
    description: '新建任务',
  }),

  // Cmd/Ctrl + /: 切换侧边栏
  toggleSidebar: (handler: () => void): KeyBinding => ({
    key: '/',
    meta: true,
    handler,
    description: '切换侧边栏',
  }),

  // Escape: 关闭模态框/取消
  escape: (handler: () => void): KeyBinding => ({
    key: 'Escape',
    handler,
    description: '关闭/取消',
  }),

  // Cmd/Ctrl + 1-9: 快速切换 Agent
  switchAgent: (index: number, handler: () => void): KeyBinding => ({
    key: String(index),
    meta: true,
    handler,
    description: `切换到 Agent ${index}`,
  }),
};
