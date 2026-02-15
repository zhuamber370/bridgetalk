import { useState, useRef, useEffect } from 'react';
import { TaskStatusBadge } from '../TaskStatusBadge';
import type { Task } from '@openclaw/shared';

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
 * 任务头部（标题 + 状态 + 操作）
 */
export function TaskHeader({
  task,
  onBack,
  onTitleChange,
  onDelete,
  onCancel,
  onArchive,
}: TaskHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [showMenu, setShowMenu] = useState(false);
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
      setTitleDraft(task.title); // 恢复原标题
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

  return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b bg-white">
      {/* 返回按钮（Mobile）*/}
      {onBack && (
        <button
          onClick={onBack}
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
      )}

      {/* 标题（可编辑）*/}
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
        <div className="flex-1 flex flex-col min-w-0">
          <span
            onClick={() => setEditingTitle(true)}
            className="text-sm font-semibold text-gray-900 truncate cursor-pointer hover:text-indigo-600 transition-colors"
          >
            {task.title}
          </span>
          <span className="text-xs text-gray-500">
            更新于 {formatTime(task.updatedAt)}
          </span>
        </div>
      )}

      {/* 状态徽章 */}
      <TaskStatusBadge status={task.status} />

      {/* 操作菜单 */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>

        {/* 下拉菜单 */}
        {showMenu && (
          <div
            className="absolute top-full right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            {onCancel && (
              <button
                onClick={() => {
                  onCancel();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                取消任务
              </button>
            )}
            {onArchive && (
              <button
                onClick={() => {
                  onArchive();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                归档
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                删除
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
