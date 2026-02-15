import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAppState, useDispatch } from '../lib/store';
import { listAgents } from '../lib/api';

/**
 * 首页 - 自动重定向到第一个 Agent 的 Inbox
 */
export function AgentListPage() {
  const { agents } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Load agents on mount
  useEffect(() => {
    listAgents()
      .then((data) => {
        dispatch({ type: 'SET_AGENTS', agents: data });

        // 如果有 Agent，自动重定向到第一个
        if (data.length > 0) {
          navigate(`/agents/${data[0].id}`, { replace: true });
        }
      })
      .catch(console.error);
  }, [dispatch, navigate]);

  // 加载中状态
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
