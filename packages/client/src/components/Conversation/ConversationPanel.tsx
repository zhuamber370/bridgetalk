import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAppState, useDispatch } from '../../lib/store';
import { listMessages, sendMessage, updateTask, deleteTask } from '../../lib/api';
import { MessageCard } from './MessageCard';
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
 * 对话/详情面板（右侧栏）
 */
export function ConversationPanel({ taskId, onBack }: ConversationPanelProps) {
  const { tasks, messagesByTask, agents } = useAppState();
  const dispatch = useDispatch();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // 首次加载时立即跳到底部（不需要动画）
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [taskId]); // 只在 taskId 变化时触发

  // 新消息到达时平滑滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    if (!confirm('确定删除这个任务吗？')) return;
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
      <div className="flex items-center justify-center h-full bg-gray-50">
        <p className="text-sm text-gray-500">任务不存在</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <TaskHeader
        task={task}
        onBack={onBack}
        onTitleChange={handleTitleChange}
        onDelete={handleDelete}
      />

      {/* 子任务提示条 */}
      {isSubTask && parentTask && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-amber-800 mb-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              这是由 <strong>{parentAgent?.name || '未知'}</strong> 委派的任务
            </span>
          </div>
          <Link
            to={`/agents/${parentTask.agentId}/tasks/${parentTask.id}`}
            className="inline-flex items-center text-sm text-amber-600 hover:underline"
          >
            → 查看主任务
          </Link>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">暂无消息</p>
          </div>
        ) : (
          messages.map((msg) => {
            // 协调消息特殊处理：如果有 subTaskId，渲染折叠区域
            if (msg.messageType === 'coordination') {
              try {
                const coordData = JSON.parse(msg.content) as CoordinationData;
                const subTask = coordData.subTaskId
                  ? tasks.find((t) => t.id === coordData.subTaskId)
                  : undefined;

                return (
                  <div key={msg.id}>
                    <MessageCard message={msg} />
                    {subTask && <SubTaskCollapse task={subTask} />}
                  </div>
                );
              } catch {
                // 解析失败，降级为普通消息
              }
            }

            return <MessageCard key={msg.id} message={msg} />;
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput onSubmit={handleSendMessage} placeholder="继续对话..." />
    </div>
  );
}
