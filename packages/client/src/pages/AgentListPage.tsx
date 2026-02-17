import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bot, Plus } from 'lucide-react';
import { useAppState, useDispatch } from '../lib/store';
import { listAgents } from '../lib/api';
import { CreateAgentModal } from '../components/CreateAgentModal';

/**
 * Home page - Auto-redirect to the first Agent's Inbox
 */
export function AgentListPage() {
  const { agents } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load agents on mount
  useEffect(() => {
    let active = true;
    listAgents()
      .then((data) => {
        if (!active) return;
        dispatch({ type: 'SET_AGENTS', agents: data });

        // If agents exist, auto-redirect to the first one
        if (data.length > 0) {
          navigate(`/agents/${data[0].id}`, { replace: true });
        }
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : String(error);
        setLoadError(message || 'Failed to load agents');
        console.error(error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dispatch, navigate]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full border-4 border-[var(--color-primary-light)] border-t-[var(--color-primary)] animate-spin" />
          <p className="text-[15px] text-[var(--color-text-secondary)] font-medium">
            {t('common.loading')}
          </p>
        </motion.div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold mb-3 text-[var(--color-text)]">{t('common.error')}</h1>
          <p className="mb-6 text-[var(--color-text-secondary)] break-words">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8 bg-[var(--color-primary-subtle)]">
            <Bot className="w-12 h-12 text-[var(--color-primary)]" />
          </div>

          <h1 className="text-2xl font-bold mb-3 text-[var(--color-text)]">
            {t('pages.welcome.title')}
          </h1>

          <p className="text-center mb-8 text-[var(--color-text-secondary)] max-w-sm">
            {t('pages.welcome.subtitle')}
          </p>

          <motion.button
            onClick={() => setShowCreateModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-[15px] font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            {t('pages.welcome.createAgent')}
          </motion.button>

          <CreateAgentModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-12 h-12 rounded-full border-4 border-[var(--color-primary-light)] border-t-[var(--color-primary)] animate-spin" />
        <p className="text-[15px] text-[var(--color-text-secondary)] font-medium">
          {t('common.loading')}
        </p>
      </motion.div>
    </div>
  );
}
