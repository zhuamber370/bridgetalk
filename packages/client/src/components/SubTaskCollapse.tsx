import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderOpen, 
  ChevronDown, 
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import type { Task, Message } from '@bridgetalk/shared';
import { useAppState } from '../lib/store';
import { MessageItem } from './Conversation/MessageItem';

const statusConfig = {
  pending: { icon: Clock, color: 'text-[var(--color-slate-500)]', bgColor: 'bg-[var(--color-slate-100)]' },
  running: { icon: Loader2, color: 'text-[var(--color-info)]', bgColor: 'bg-[var(--color-info-light)]' },
  completed: { icon: CheckCircle2, color: 'text-[var(--color-success)]', bgColor: 'bg-[var(--color-success-light)]' },
  failed: { icon: XCircle, color: 'text-[var(--color-error)]', bgColor: 'bg-[var(--color-error-light)]' },
  waiting: { icon: AlertCircle, color: 'text-[var(--color-warning)]', bgColor: 'bg-[var(--color-warning-light)]' },
  cancelled: { icon: Clock, color: 'text-[var(--color-slate-400)]', bgColor: 'bg-[var(--color-slate-100)]' },
};

export function SubTaskCollapse({ task }: { task?: Task }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { messagesByTask, agents } = useAppState();

  if (!task) return null;

  const subMessages = messagesByTask[task.id] || [];
  const agent = agents.find((a) => a.id === task.agentId);
  const status = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-3 border border-[var(--color-delegated)]/30 rounded-xl overflow-hidden bg-white"
    >
      {/* 折叠标题 */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        whileHover={{ backgroundColor: 'var(--color-delegated-light)' }}
        className="w-full px-4 py-3 bg-[var(--color-delegated-light)]/50 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-3"
        >
          <div className={`w-8 h-8 rounded-lg ${status.bgColor} flex items-center justify-center`}>
            <StatusIcon className={`w-4 h-4 ${status.color} ${task.status === 'running' ? 'animate-spin' : ''}`} />
          </div>
          
          <div className="text-left"
          >
            <span className="text-[14px] font-semibold text-[var(--color-delegated-dark)]">
              {agent?.name || task.agentId}
            </span>
            <p className="text-[12px] text-[var(--color-delegated)]">
              {t('taskInbox.workProcess')}
            </p>
          </div>
        </div>
        
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-[var(--color-delegated)]" />
        </motion.div>
      </motion.button>

      {/* 展开内容 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-4 border-t border-[var(--color-delegated)]/20"
            >
              {subMessages.length === 0 ? (
                <div className="text-[14px] text-[var(--color-text-muted)] text-center py-6"
                >
                  {t('message.noMessages')}
                </div>
              ) : (
                <div className="space-y-0">
                  {subMessages.map((msg: Message, index) => {
                    const prevMessage = index > 0 ? subMessages[index - 1] : undefined;
                    const isGrouped = Boolean(
                      prevMessage &&
                      prevMessage.senderType === msg.senderType &&
                      prevMessage.senderAgentId === msg.senderAgentId &&
                      msg.timestamp - prevMessage.timestamp < 60000
                    );

                    return (
                      <MessageItem
                        key={msg.id}
                        message={msg}
                        isGrouped={isGrouped}
                      />
                    );
                  })}
                </div>
              )}
              
              <div className="mt-4 text-right">
                <Link
                  to={`/agents/${task.agentId}/tasks/${task.id}`}
                  className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-delegated)] hover:text-[var(--color-delegated-dark)] font-medium transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  {t('taskInbox.viewFullConversation')}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
