import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, useDispatch } from '../lib/store';
import { listAgents, createAgent, deleteAgent, listTasks, listOpenClawAgents } from '../lib/api';
import type { OpenClawAgentInfo } from '../lib/api';
import { AgentCard } from '../components/AgentCard';

export function AgentListPage() {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [openclawAgents, setOpenclawAgents] = useState<OpenClawAgentInfo[]>([]);
  const [importing, setImporting] = useState<string | null>(null);

  const { agents, tasks } = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Load agents + tasks on mount
  useEffect(() => {
    listAgents()
      .then((data) => dispatch({ type: 'SET_AGENTS', agents: data }))
      .catch(console.error);
    listTasks()
      .then((data) => dispatch({ type: 'SET_TASKS', tasks: data }))
      .catch(console.error);
  }, [dispatch]);

  const taskCountByAgent = (agentId: string) =>
    tasks.filter((t) => t.agentId === agentId).length;

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
      const agent = await createAgent({ id, name, description: formDesc.trim() || undefined });
      dispatch({ type: 'ADD_AGENT', agent });
      setShowForm(false);
      setFormId('');
      setFormName('');
      setFormDesc('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAgent(id);
      dispatch({ type: 'REMOVE_AGENT', id });
    } catch (err) {
      console.error('删除 Agent 失败:', err);
    }
  };

  // 打开导入面板，加载 OpenClaw 工作区 agents
  const handleOpenImport = async () => {
    setShowImport(true);
    setError('');
    try {
      const list = await listOpenClawAgents();
      setOpenclawAgents(list);
    } catch (err) {
      setError('无法读取 OpenClaw 工作区: ' + (err as Error).message);
    }
  };

  // 从工作区导入 agent
  const handleImport = async (oca: OpenClawAgentInfo) => {
    setImporting(oca.id);
    try {
      const agent = await createAgent({
        id: oca.id,
        name: oca.name,
        description: oca.model ? `模型: ${oca.model}` : undefined,
      });
      dispatch({ type: 'ADD_AGENT', agent });
    } catch (err) {
      console.error('导入 Agent 失败:', err);
    } finally {
      setImporting(null);
    }
  };

  // 过滤掉已存在的 agents
  const localAgentIds = new Set(agents.map((a) => a.id));
  const importableAgents = openclawAgents.filter((a) => !localAgentIds.has(a.id));

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white">
        <h1 className="text-lg font-semibold text-gray-900">OpenClaw Agents</h1>
      </div>

      {/* Agent grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {agents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">加载中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                taskCount={taskCountByAgent(agent.id)}
                onClick={() => navigate(`/agents/${agent.id}`)}
                onDelete={agent.id !== 'main' ? () => handleDelete(agent.id) : undefined}
              />
            ))}

            {/* New Agent button */}
            <button
              onClick={() => { setShowForm(true); setError(''); }}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors min-h-[100px]"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="text-xs font-medium">新建 Agent</span>
            </button>
          </div>
        )}

        {/* Import from workspace button */}
        <button
          onClick={handleOpenImport}
          className="w-full mt-4 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          从工作区导入
        </button>
      </div>

      {/* Create Agent Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900">新建 Agent</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ID</label>
                <input
                  type="text"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value.toLowerCase())}
                  placeholder="例如: travel-assistant"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如: 旅行助手"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">描述（可选）</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="这个 Agent 擅长什么..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-40"
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import from Workspace Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={() => setShowImport(false)}>
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900">从工作区导入</h2>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex-1 overflow-y-auto space-y-2">
              {importableAgents.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  {openclawAgents.length === 0 ? '加载中...' : '没有可导入的 Agent（全部已添加）'}
                </p>
              ) : (
                importableAgents.map((oca) => (
                  <div
                    key={oca.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-200 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{oca.name}</span>
                        {oca.isDefault && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600">默认</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {oca.id}{oca.model ? ` · ${oca.model}` : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => handleImport(oca)}
                      disabled={importing === oca.id}
                      className="shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-40"
                    >
                      {importing === oca.id ? '导入中...' : '导入'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowImport(false)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
