import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppState, useDispatch } from '../lib/store';
import { listMessages, sendMessage, getTask, updateTask } from '../lib/api';
import { MessageBubble } from '../components/MessageBubble';
import { SubTaskCollapse } from '../components/SubTaskCollapse';
import { TaskStatusBadge } from '../components/TaskStatusBadge';
import type { Task, Message, CoordinationData } from '@bridgetalk/shared';

export function TaskDetailPage() {
  const { t } = useTranslation();
  const { agentId, taskId: id } = useParams<{ agentId: string; taskId: string }>();
  const navigate = useNavigate();
  const { tasks, messagesByTask, agents } = useAppState();
  const dispatch = useDispatch();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const task = tasks.find((t) => t.id === id);
  const messages = id ? messagesByTask[id] ?? [] : [];

  // 🆕 子任务相关数据
  const isSubTask = !!task?.parentTaskId;
  const parentTask = isSubTask ? tasks.find(t => t.id === task.parentTaskId) : null;
  const parentAgent = parentTask ? agents.find(a => a.id === parentTask.agentId) : null;

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
      console.error(t('errors.sendMessageFailed'), err);
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
      console.error(t('pages.taskDetail.updateTitleFailed'), err);
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
            {task?.title ?? t('common.loading')}
          </span>
        )}

        {task && <TaskStatusBadge status={task.status} />}
      </div>

      {/* 🆕 子任务提示条 */}
      {isSubTask && parentTask && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-amber-800 mb-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>
              {t('pages.taskDetail.delegatedBy', { agentName: parentAgent?.name || t('common.unknown') })}
            </span>
          </div>
          <Link
            to={`/agents/${parentTask.agentId}/tasks/${parentTask.id}`}
            className="inline-flex items-center text-sm text-amber-600 hover:underline"
          >
            → {t('pages.taskDetail.viewParentTask')}
          </Link>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">{t('message.noMessages')}</p>
          </div>
        ) : (
          messages.map((msg) => {
            // 🆕 协调消息特殊处理：如果有 subTaskId，渲染折叠区域
            if (msg.messageType === 'coordination') {
              try {
                const coordData = JSON.parse(msg.content) as CoordinationData;
                const subTask = coordData.subTaskId ? tasks.find(t => t.id === coordData.subTaskId) : undefined;

                return (
                  <div key={msg.id}>
                    <MessageBubble message={msg} />
                    {subTask && <SubTaskCollapse task={subTask} />}
                  </div>
                );
              } catch {
                // 解析失败，降级为普通消息
              }
            }

            return <MessageBubble key={msg.id} message={msg} />;
          })
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
          placeholder={t('pages.taskDetail.continueConversation')}
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
