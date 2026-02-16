import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import { useAppState, useDispatch } from '../../lib/store';
import { listMessages, sendMessage, updateTask, deleteTask } from '../../lib/api';
import { MessageItem, MessageList } from './MessageItem';
import { TaskHeader } from './TaskHeader';
import { MessageInput } from './MessageInput';
import { SubTaskCollapse } from '../SubTaskCollapse';
import type { Task, Message, CoordinationData } from '@bridgetalk/shared';

export interface ConversationPanelProps {
  /** Task ID */
  taskId: string;
  /** Back button click callback (Mobile) */
  onBack?: () => void;
}

/**
 * Refactored conversation/detail panel
 *
 * Improvements:
 * 1. Use new MessageItem component
 * 2. Better empty state design
 * 3. Smooth scroll animation
 * 4. Improved visual hierarchy
 */
export function ConversationPanel({ taskId, onBack }: ConversationPanelProps) {
  const { t } = useTranslation();
  const { tasks, messagesByTask, agents } = useAppState();
  const dispatch = useDispatch();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const task = tasks.find((t) => t.id === taskId);
  const messages = messagesByTask[taskId] ?? [];

  // Sub-task related
  const isSubTask = !!task?.parentTaskId;
  const parentTask = isSubTask ? tasks.find((t) => t.id === task.parentTaskId) : null;
  const parentAgent = parentTask ? agents.find((a) => a.id === parentTask.agentId) : null;

  // Load messages + poll every 3s as SSE fallback
  useEffect(() => {
    const fetchMessages = () =>
      listMessages(taskId)
        .then((msgs) => dispatch({ type: 'SET_MESSAGES', taskId, messages: msgs }))
        .catch(console.error);

    fetchMessages();
    const timer = setInterval(fetchMessages, 3000);
    return () => clearInterval(timer);
  }, [taskId, dispatch]);

  // Jump to bottom immediately on first load
  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [taskId]);

  // Smooth scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Send message
  const handleSendMessage = async (text: string) => {
    // Optimistic update
    const optimisticMsg: Message = {
      id: `tmp_${Date.now()}`,
      taskId,
      senderType: 'user',
      content: text,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_MESSAGE', message: optimisticMsg });

    try {
      await sendMessage(taskId, text);
    } catch (err) {
      console.error(t('errors.sendMessageFailed'), err);
      throw err;
    }
  };

  // Modify title
  const handleTitleChange = async (newTitle: string) => {
    if (!task) return;
    try {
      const updated = await updateTask(taskId, { title: newTitle });
      dispatch({ type: 'UPDATE_TASK', task: updated });
    } catch (err) {
      console.error(t('pages.taskDetail.updateTitleFailed'), err);
    }
  };

  // Delete task
  const handleDelete = async () => {
    try {
      await deleteTask(taskId);
      dispatch({ type: 'REMOVE_TASK', id: taskId });
      onBack?.();
    } catch (err) {
      console.error(t('errors.deleteTaskFailed'), err);
    }
  };

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-bg-secondary)]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-8"
        >
          <div className="w-16 h-16 rounded-full bg-[var(--color-slate-200)] flex items-center justify-center mx-auto mb-4">
            <Info className="w-8 h-8 text-[var(--color-slate-400)]" />
          </div>
          <p className="text-[var(--color-text-secondary)]">{t('pages.taskDetail.taskNotFound')}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white"
    >
      {/* Header */}
      <TaskHeader
        task={task}
        onBack={onBack}
        onTitleChange={handleTitleChange}
        onDelete={handleDelete}
      />

      {/* Sub-task banner */}
      <AnimatePresence>
        {isSubTask && parentTask && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-[var(--color-delegated)]/30 overflow-hidden"
          >
            <div className="mx-4 mt-3 p-3 bg-[var(--color-delegated-light)] rounded-xl mb-3"
            >
              <div className="flex items-center gap-2 text-[13px] text-[var(--color-delegated-dark)] mb-2"
              >
                <Info className="w-4 h-4" />
                <span>
                  {t('pages.taskDetail.delegatedBy', { agentName: parentAgent?.name || t('common.unknown') })}
                </span>
              </div>
              <Link
                to={`/agents/${parentTask.agentId}/tasks/${parentTask.id}`}
                className="inline-flex items-center text-[13px] text-[var(--color-delegated)] hover:underline font-medium"
              >
                {t('pages.taskDetail.viewParentTask')} →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="w-20 h-20 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center mb-4"
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
            </div>
            <p className="text-[var(--color-text-secondary)] font-medium mb-1">
              {t('pages.taskDetail.noMessages')}
            </p>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {t('pages.taskDetail.sendFirstMessage')}
            </p>
          </motion.div>
        ) : (
          <>
            {messages.map((msg, index) => {
              // Check if consecutive message
              const prevMessage = index > 0 ? messages[index - 1] : undefined;
              const isGrouped = Boolean(
                prevMessage &&
                prevMessage.senderType === msg.senderType &&
                prevMessage.senderAgentId === msg.senderAgentId &&
                msg.timestamp - prevMessage.timestamp < 60000
              );

              // Special handling for coordination messages: if subTaskId exists, render collapse area
              if (msg.messageType === 'coordination') {
                try {
                  const coordData = JSON.parse(msg.content) as CoordinationData;
                  const subTask = coordData.subTaskId
                    ? tasks.find((t) => t.id === coordData.subTaskId)
                    : undefined;

                  return (
                    <div key={msg.id} >
                      <MessageItem message={msg} isGrouped={isGrouped} />
                      {subTask && <SubTaskCollapse task={subTask} />}
                    </div>
                  );
                } catch {
                  // Parse failed, fallback to regular message
                }
              }

              return (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  isGrouped={isGrouped}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <MessageInput
        onSubmit={handleSendMessage}
        placeholder={t('pages.taskDetail.continueConversation')}
      />
    </div>
  );
}
