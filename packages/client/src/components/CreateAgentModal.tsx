import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from '../lib/store';
import { createAgent, listOpenClawModels } from '../lib/api';
import type { OpenClawModelInfo } from '../lib/api';

export interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 新建 Agent 模态框组件
 */
export function CreateAgentModal({ isOpen, onClose }: CreateAgentModalProps) {
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formModel, setFormModel] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [availableModels, setAvailableModels] = useState<OpenClawModelInfo[]>([]);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Load available models when modal opens
  useEffect(() => {
    if (isOpen) {
      listOpenClawModels().then(setAvailableModels).catch(console.error);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    setError('');
    const id = formId.trim();
    const name = formName.trim();

    if (!id || !name) {
      setError('ID 和名称不能为空');
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      setError('ID 只允许小写字母、数字和短横线');
      return;
    }

    setCreating(true);
    try {
      const agent = await createAgent({
        id,
        name,
        description: formDesc.trim() || undefined,
        model: formModel || undefined,
      });
      dispatch({ type: 'ADD_AGENT', agent });

      // 重置表单
      setFormId('');
      setFormName('');
      setFormDesc('');
      setFormModel('');
      setError('');

      // 关闭模态框
      onClose();

      // 跳转到新创建的 Agent
      navigate(`/agents/${agent.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleCreate();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-5 animate-slide-in-right"
        style={{
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            新建 Agent
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              ID
            </label>
            <input
              type="text"
              value={formId}
              onChange={(e) => setFormId(e.target.value.toLowerCase())}
              onKeyDown={handleKeyDown}
              placeholder="例如: travel-assistant"
              autoFocus
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              style={{ borderRadius: 'var(--radius-md)' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              小写字母、数字和短横线
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              名称
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例如: 旅行助手"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              style={{ borderRadius: 'var(--radius-md)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              描述（可选）
            </label>
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="这个 Agent 擅长什么..."
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              style={{ borderRadius: 'var(--radius-md)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              模型
            </label>
            <select
              value={formModel}
              onChange={(e) => setFormModel(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <option value="">使用默认模型</option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.alias ? `${m.alias} (${m.id})` : m.id}
                  {m.isDefault ? ' - 默认' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
            style={{
              background: 'var(--color-primary)',
              borderRadius: 'var(--radius-md)',
            }}
            onMouseOver={(e) =>
              !creating && (e.currentTarget.style.background = 'var(--color-primary-hover)')
            }
            onMouseOut={(e) =>
              !creating && (e.currentTarget.style.background = 'var(--color-primary)')
            }
          >
            {creating ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
