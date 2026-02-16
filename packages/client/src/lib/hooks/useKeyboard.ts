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
 * Keyboard binding Hook
 * @param bindings Array of keyboard binding configurations
 * @param enabled Whether to enable (default true)
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

        // Cmd/Ctrl universal handling (macOS uses Cmd, Windows/Linux uses Ctrl)
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
 * Global keyboard shortcuts presets
 */
export const globalKeyBindings = {
  // Cmd/Ctrl + K: Quick search
  quickSearch: (handler: () => void): KeyBinding => ({
    key: 'k',
    meta: true,
    handler,
    description: 'Quick search tasks',
  }),

  // Cmd/Ctrl + N: New task
  newTask: (handler: () => void): KeyBinding => ({
    key: 'n',
    meta: true,
    handler,
    description: 'Create new task',
  }),

  // Cmd/Ctrl + /: Toggle sidebar
  toggleSidebar: (handler: () => void): KeyBinding => ({
    key: '/',
    meta: true,
    handler,
    description: 'Toggle sidebar',
  }),

  // Escape: Close modal/cancel
  escape: (handler: () => void): KeyBinding => ({
    key: 'Escape',
    handler,
    description: 'Close/cancel',
  }),

  // Cmd/Ctrl + 1-9: Quick switch Agent
  switchAgent: (index: number, handler: () => void): KeyBinding => ({
    key: String(index),
    meta: true,
    handler,
    description: `Switch to Agent ${index}`,
  }),
};
