import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import { useAppState, useDispatch } from '../../lib/store';
import { listMessages, sendMessage, updateTask, deleteTask } from '../../lib/api';
import { MessageItem, MessageList } from './MessageItem';
import { TaskHeader } from './TaskHeader';
import { MessageInput } from './MessageInput';
import { SubTaskCollapse } from '../SubTaskCollapse';
import type { Task, Message, CoordinationData } from '@openclaw/shared';

export interface ConversationPanelProps {
  /** 任务 ID */
  taskId: string;
  /** 返回按钮点击回调（Mobile）*/
  onBack?: () => void;
}

/**
 * 重构后的对话/详情面板
 * 
 * 改进点：
 * 1. 使用新的MessageItem组件
 * 2. 更好的空状态设计
 * 3. 平滑的滚动动画
 * 4. 改进的视觉层次
 */
export function ConversationPanel({ taskId, onBack }: ConversationPanelProps) {
  const { tasks, messagesByTask, agents } = useAppState();
  const dispatch = useDispatch();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const task = tasks.find((t) => t.id === taskId);
  const messages = messagesByTask[taskId] ?? [];

  // 子任务相关
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

  // 首次加载时立即跳到底部
  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [taskId]);

  // 新消息到达时平滑滚动到底部
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // 发送消息
  const handleSendMessage = async (text: string) => {
    // 乐观更新
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
      console.error('发送消息失败:', err);
      throw err;
    }
  };

  // 修改标题
  const handleTitleChange = async (newTitle: string) => {
    if (!task) return;
    try {
      const updated = await updateTask(taskId, { title: newTitle });
      dispatch({ type: 'UPDATE_TASK', task: updated });
    } catch (err) {
      console.error('修改标题失败:', err);
    }
  };

  // 删除任务
  const handleDelete = async () => {
    try {
      await deleteTask(taskId);
      dispatch({ type: 'REMOVE_TASK', id: taskId });
      onBack?.();
    } catch (err) {
      console.error('删除任务失败:', err);
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
          <p className="text-[var(--color-text-secondary)]">任务不存在</p>
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

      {/* 子任务提示条 */}
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
                  这是由 <strong>{parentAgent?.name || '未知'}</strong> 委派的任务
                </span>
              </div>
              <Link
                to={`/agents/${parentTask.agentId}/tasks/${parentTask.id}`}
                className="inline-flex items-center text-[13px] text-[var(--color-delegated)] hover:underline font-medium"
              >
                查看主任务 →
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
              还没有消息
            </p>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              发送第一条消息开始对话
            </p>
          </motion.div>
        ) : (
          <>
            {messages.map((msg, index) => {
              // 判断是否为连续消息
              const prevMessage = index > 0 ? messages[index - 1] : undefined;
              const isGrouped = Boolean(
                prevMessage &&
                prevMessage.senderType === msg.senderType &&
                prevMessage.senderAgentId === msg.senderAgentId &&
                msg.timestamp - prevMessage.timestamp < 60000
              );

              // 协调消息特殊处理：如果有 subTaskId，渲染折叠区域
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
                  // 解析失败，降级为普通消息
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
        placeholder="继续对话..."
      />
    </div>
  );
}
