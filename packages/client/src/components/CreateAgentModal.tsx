import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Bot, 
  AlertCircle, 
  ChevronDown,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useDispatch } from '../lib/store';
import { createAgent, listOpenClawModels } from '../lib/api';
import type { OpenClawModelInfo } from '../lib/api';

export interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
  const { t } = useTranslation();

  // Load available models and reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      listOpenClawModels().then(setAvailableModels).catch(console.error);
      // Reset form data
      setFormId('');
      setFormName('');
      setFormDesc('');
      setFormModel('');
      setError('');
    }
  }, [isOpen]);

  const handleCreate = async () => {
    setError('');
    const id = formId.trim();
    const name = formName.trim();

    if (!id || !name) {
      setError(t('createAgent.errorRequired'));
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      setError(t('createAgent.errorInvalidId'));
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

      // Reset form
      setFormId('');
      setFormName('');
      setFormDesc('');
      setFormModel('');
      setError('');

      // Close modal
      onClose();

      // Navigate to newly created Agent
      navigate(`/agents/${agent.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-xl bg-white sm:rounded-3xl rounded-t-3xl z-50 max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl"
          >
            {/* Drag bar (mobile) */}
            <div className="flex justify-center pt-4 pb-3 sm:hidden">
              <div className="w-12 h-1.5 bg-[var(--color-slate-300)] rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center">
                  <Bot className="w-6 h-6 text-[var(--color-primary)]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text)]">{t('createAgent.title')}</h2>
                  <p className="text-[14px] text-[var(--color-text-muted)]">{t('createAgent.subtitle')}</p>
                </div>
              </div>
              
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-xl hover:bg-[var(--color-bg-secondary)] flex items-center justify-center transition-colors"
              >
                <X className="w-6 h-6 text-[var(--color-text-secondary)]" />
              </motion.button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(95vh-280px)]">
              {/* ID */}
              <div>
                <label className="block text-[15px] font-semibold text-[var(--color-text)] mb-3">
                  {t('createAgent.agentId')} *
                </label>
                <input
                  type="text"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value.toLowerCase())}
                  placeholder={t('createAgent.agentIdPlaceholder')}
                  autoFocus
                  className="w-full rounded-xl border border-[var(--color-border)] px-5 py-4 text-[16px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] transition-all bg-[var(--color-bg-secondary)]"
                />
                <p className="text-[13px] mt-2 text-[var(--color-text-muted)]">
                  {t('createAgent.agentIdHint')}
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-[15px] font-semibold text-[var(--color-text)] mb-3">
                  {t('createAgent.displayName')} *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t('createAgent.displayNamePlaceholder')}
                  className="w-full rounded-xl border border-[var(--color-border)] px-5 py-4 text-[16px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] transition-all bg-[var(--color-bg-secondary)]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[15px] font-semibold text-[var(--color-text)] mb-3">
                  {t('createAgent.description')}
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder={t('createAgent.descriptionPlaceholder')}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--color-border)] px-5 py-4 text-[16px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] transition-all bg-[var(--color-bg-secondary)] resize-none"
                />
              </div>

              {/* Model */}
              <div className="pb-2">
                <label className="block text-[15px] font-semibold text-[var(--color-text)] mb-3">
                  {t('createAgent.model')}
                </label>
                <div className="relative">
                  <select
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] px-5 py-4 text-[16px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] transition-all bg-[var(--color-bg-secondary)] appearance-none cursor-pointer"
                  >
                    <option value="">{t('createAgent.defaultModel')}</option>
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.alias ? `${m.alias} (${m.id})` : m.id}
                        {m.isDefault ? ` - ${t('createAgent.default')}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 pb-4"
                >
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-error-light)] border border-[var(--color-error)]/20">
                    <AlertCircle className="w-5 h-5 text-[var(--color-error)] shrink-0" />
                    <p className="text-[14px] text-[var(--color-error-dark)]">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-4 p-6 pt-4 border-t border-[var(--color-border)] bg-white">
              <motion.button
                onClick={() => {
                  // Clear form data
                  setFormId('');
                  setFormName('');
                  setFormDesc('');
                  setFormModel('');
                  setError('');
                  onClose();
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 px-6 py-4 rounded-xl text-[16px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-slate-200)] transition-colors"
              >
                {t('common.cancel')}
              </motion.button>
              
              <motion.button
                onClick={handleCreate}
                disabled={creating}
                whileHover={{ scale: creating ? 1 : 1.02 }}
                whileTap={{ scale: creating ? 1 : 0.98 }}
                className="flex-1 px-6 py-4 rounded-xl text-[16px] font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('common.creating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    {t('createAgent.title')}
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
