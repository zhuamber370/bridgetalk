import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  MoreHorizontal, 
  Trash2, 
  Archive, 
  XCircle,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { TaskStatusBadge } from '../TaskStatusBadge';
import type { Task } from '@bridgetalk/shared';

export interface TaskHeaderProps {
  task: Task;
  /** 返回按钮点击回调（Mobile）*/
  onBack?: () => void;
  /** 标题修改回调 */
  onTitleChange?: (newTitle: string) => void;
  /** 任务操作菜单回调 */
  onDelete?: () => void;
  onCancel?: () => void;
  onArchive?: () => void;
}

/**
 * 重构后的任务头部
 * 
 * 改进点：
 * 1. 更大的标题字体
 * 2. 改进的操作按钮布局
 * 3. 更好的编辑交互
 * 4. 折叠显示额外信息
 */
export function TaskHeader({
  task,
  onBack,
  onTitleChange,
  onDelete,
  onCancel,
  onArchive,
}: TaskHeaderProps) {
  const { t } = useTranslation();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus title input when editing
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleSaveTitle = () => {
    setEditingTitle(false);
    const newTitle = titleDraft.trim();
    if (newTitle && newTitle !== task.title) {
      onTitleChange?.(newTitle);
    } else {
      setTitleDraft(task.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    }
    if (e.key === 'Escape') {
      setEditingTitle(false);
      setTitleDraft(task.title);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div className="shrink-0 border-b border-[var(--color-border)] bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* 返回按钮（Mobile）*/}
        {onBack && (
          <motion.button
            onClick={onBack}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </motion.button>
        )}

        {/* 标题（可编辑）*/}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2"
            >
              <input
                ref={titleInputRef}
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleSaveTitle}
                className="flex-1 text-[17px] font-bold text-[var(--color-text)] border-b-2 border-[var(--color-primary)] outline-none bg-transparent py-1"
              />
              <motion.button
                onClick={handleSaveTitle}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-7 h-7 rounded-lg bg-[var(--color-success-light)] text-[var(--color-success)] flex items-center justify-center"
              >
                <Check className="w-4 h-4" />
              </motion.button>
              <motion.button
                onClick={() => {
                  setEditingTitle(false);
                  setTitleDraft(task.title);
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-7 h-7 rounded-lg bg-[var(--color-slate-100)] text-[var(--color-text-secondary)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          ) : (
            <div className="flex flex-col min-w-0"
            >
              <div className="flex items-center gap-2"
              >
                <motion.span
                  onClick={() => setEditingTitle(true)}
                  whileHover={{ color: 'var(--color-primary)' }}
                  className="text-[17px] font-bold text-[var(--color-text)] truncate cursor-pointer transition-colors flex items-center gap-2"
                  title={t('pages.taskDetail.clickToEdit')}
                >
                  {task.title}
                  <Edit3 className="w-4 h-4 opacity-0 hover:opacity-100 transition-opacity text-[var(--color-text-muted)]" />
                </motion.span>
              </div>
              
              <div className="flex items-center gap-3 mt-0.5"
              >
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  {t('pages.taskDetail.updateAt', { time: formatTime(task.updatedAt) })}
                </span>
                
                <motion.button
                  onClick={() => setShowDetails(!showDetails)}
                  whileHover={{ scale: 1.05 }}
                  className="text-[11px] text-[var(--color-primary)] hover:underline"
                >
                  {showDetails ? t('common.collapse') : t('common.details')}
                </motion.button>
              </div>
            </div>
          )}
        </div>

        {/* 状态徽章 */}
        <div className="shrink-0">
          <TaskStatusBadge status={task.status} size="md" />
        </div>

        {/* 操作菜单 */}
        <div className="relative" ref={menuRef}>
          <motion.button
            onClick={() => setShowMenu(!showMenu)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <MoreHorizontal className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </motion.button>

          {/* 下拉菜单 */}
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-[var(--color-border)] py-1.5 z-50"
                style={{ boxShadow: 'var(--shadow-lg)' }}
              >
                {onCancel && task.status !== 'cancelled' && task.status !== 'completed' && (
                  <motion.button
                    onClick={() => {
                      onCancel();
                      setShowMenu(false);
                    }}
                    whileHover={{ backgroundColor: 'var(--color-bg-secondary)' }}
                    className="w-full px-4 py-2.5 text-left text-[13px] text-[var(--color-text)] flex items-center gap-2.5"
                  >
                    <XCircle className="w-4 h-4 text-[var(--color-text-muted)]" />
                    {t('common.cancelTask')}
                  </motion.button>
                )}
                {onArchive && (
                  <motion.button
                    onClick={() => {
                      onArchive();
                      setShowMenu(false);
                    }}
                    whileHover={{ backgroundColor: 'var(--color-bg-secondary)' }}
                    className="w-full px-4 py-2.5 text-left text-[13px] text-[var(--color-text)] flex items-center gap-2.5"
                  >
                    <Archive className="w-4 h-4 text-[var(--color-text-muted)]" />
                    {t('common.archive')}
                  </motion.button>
                )}
                {onDelete && (
                  <>
                    <div className="border-t border-[var(--color-border)] my-1" />
                    <motion.button
                      onClick={() => {
                        if (confirm(t('common.confirm'))) {
                          onDelete();
                        }
                        setShowMenu(false);
                      }}
                      whileHover={{ backgroundColor: 'var(--color-error-light)' }}
                      className="w-full px-4 py-2.5 text-left text-[13px] text-[var(--color-error)] flex items-center gap-2.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('common.deleteTask')}
                    </motion.button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 详情面板 */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
          >
            <div className="px-4 py-3 grid grid-cols-2 gap-3 text-[12px]"
            >
              <div>
                <span className="text-[var(--color-text-muted)]">{t('pages.taskDetail.taskId')}: </span>
                <span className="text-[var(--color-text-secondary)] font-mono">{task.id.slice(-8)}</span>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)]">{t('pages.taskDetail.createdAt')}: </span>
                <span className="text-[var(--color-text-secondary)]">{formatTime(task.createdAt)}</span>
              </div>
              {task.parentTaskId && (
                <div className="col-span-2">
                  <span className="text-[var(--color-text-muted)]">{t('pages.taskDetail.parentTask')}: </span>
                  <span className="text-[var(--color-delegated)]">{task.parentTaskId.slice(-8)}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
