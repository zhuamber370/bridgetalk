import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppState, useDispatch } from '../lib/store';
import { listMessages, sendMessage, getTask, updateTask } from '../lib/api';
import { MessageBubble } from '../components/MessageBubble';
import { TaskStatusBadge } from '../components/TaskStatusBadge';
import type { Task, Message } from '@openclaw/shared';

export function TaskDetailPage() {
  const { agentId, taskId: id } = useParams<{ agentId: string; taskId: string }>();
  const navigate = useNavigate();
  const { tasks, messagesByTask } = useAppState();
  const dispatch = useDispatch();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const task = tasks.find((t) => t.id === id);
  const messages = id ? messagesByTask[id] ?? [] : [];

  // Load task + poll status every 3s
  useEffect(() => {
    if (!id) return;
    const fetchTask = () =>
      getTask(id)
        .then((t: Task) => dispatch({ type: 'ADD_TASK', task: t }))
        .catch(console.error);
    fetchTask();
    const timer = setInterval(fetchTask, 3000);
    return () => clearInterval(timer);
  }, [id, dispatch]);

  // Load messages + poll every 3s as SSE fallback
  useEffect(() => {
    if (!id) return;
    const fetchMessages = () =>
      listMessages(id)
        .then((msgs) => dispatch({ type: 'SET_MESSAGES', taskId: id, messages: msgs }))
        .catch(console.error);
    fetchMessages();
    const timer = setInterval(fetchMessages, 3000);
    return () => clearInterval(timer);
  }, [id, dispatch]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Focus title input when editing
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || sending || !id) return;
    setSending(true);
    setInput('');

    // 乐观更新：立即显示用户消息
    const optimisticMsg: Message = {
      id: `tmp_${Date.now()}`,
      taskId: id,
      senderType: 'user',
      content: text,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_MESSAGE', message: optimisticMsg });

    try {
      await sendMessage(id, text);
    } catch (err) {
      console.error('发送消息失败:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTitleClick = () => {
    if (!task) return;
    setTitleDraft(task.title);
    setEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    setEditingTitle(false);
    const newTitle = titleDraft.trim();
    if (!newTitle || !id || newTitle === task?.title) return;
    try {
      const updated = await updateTask(id, { title: newTitle });
      dispatch({ type: 'UPDATE_TASK', task: updated });
    } catch (err) {
      console.error('修改标题失败:', err);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    }
    if (e.key === 'Escape') {
      setEditingTitle(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-white">
        <button
          onClick={() => navigate(`/agents/${agentId}`)}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Title: click to edit */}
        {editingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            onBlur={handleSaveTitle}
            className="flex-1 text-sm font-medium text-gray-900 border-b-2 border-indigo-400 outline-none bg-transparent py-0.5"
          />
        ) : (
          <span
            onClick={handleTitleClick}
            className="text-sm font-medium text-gray-900 truncate flex-1 cursor-pointer hover:text-indigo-600 transition-colors"
          >
            {task?.title ?? '加载中...'}
          </span>
        )}

        {task && <TaskStatusBadge status={task.status} />}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">暂无消息</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-t bg-white"
        style={{ paddingBottom: 'calc(12px + var(--safe-area-bottom))' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="继续对话..."
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || sending}
          className="shrink-0 w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
