import { create } from 'zustand';
import type { Message } from '@openclaw/shared';
import { api } from '../api/client';

interface MessageState {
  messages: Record<string, Message[]>; // taskId -> messages
  loading: boolean;

  fetchMessages: (taskId: string) => Promise<void>;
  sendMessage: (taskId: string, content: string) => Promise<void>;
  addMessage: (taskId: string, message: Message) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: {},
  loading: false,

  fetchMessages: async (taskId: string) => {
    set({ loading: true });
    try {
      const msgs = await api.listMessages(taskId);
      set(s => ({
        messages: { ...s.messages, [taskId]: msgs },
        loading: false,
      }));
    } catch (err) {
      console.error('[message-store] fetchMessages error:', err);
      set({ loading: false });
    }
  },

  sendMessage: async (taskId: string, content: string) => {
    const msg = await api.sendMessage(taskId, { content });
    get().addMessage(taskId, msg);
  },

  addMessage: (taskId: string, message: Message) => {
    set(s => {
      const existing = s.messages[taskId] || [];
      // Avoid duplicates
      if (existing.some(m => m.id === message.id)) return s;
      return {
        messages: { ...s.messages, [taskId]: [...existing, message] },
      };
    });
  },
}));
