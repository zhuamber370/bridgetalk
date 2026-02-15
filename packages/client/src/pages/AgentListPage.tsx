import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, useDispatch } from '../lib/store';
import { listAgents } from '../lib/api';

/**
 * 首页 - 自动重定向到第一个 Agent 的 Inbox
 * 如果没有 Agent，重定向会在 AgentInboxPage 中处理（显示欢迎页）
 */
export function AgentListPage() {
  const { agents } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();

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
    <div className="flex items-center justify-center h-full">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        加载中...
      </p>
    </div>
  );
}
