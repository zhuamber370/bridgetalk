import { useState } from 'react';
import { api } from '../api/client';
import { useTaskStore } from '../store/task-store';

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const { fetchTasks } = useTaskStore();

  const handleExport = async () => {
    setExporting(true);
    setStatusMessage('');
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openclaw-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage(`导出成功 (SHA256: ${data.checksum.slice(0, 12)}...)`);
    } catch (err) {
      setStatusMessage(`导出失败: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setImporting(true);
      setStatusMessage('');
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await api.importData(data);
        await fetchTasks();
        setStatusMessage('导入成功，数据已恢复');
      } catch (err) {
        setStatusMessage(`导入失败: ${(err as Error).message}`);
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const handleWipe = async () => {
    if (!wipeConfirm) {
      setWipeConfirm(true);
      return;
    }

    setWiping(true);
    setStatusMessage('');
    try {
      await api.wipeData();
      await fetchTasks();
      setStatusMessage('所有数据已擦除');
      setWipeConfirm(false);
    } catch (err) {
      setStatusMessage(`擦除失败: ${(err as Error).message}`);
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="flex items-center h-14 px-4 border-b border-gray-200 bg-white shrink-0">
        <button onClick={onBack} className="mr-3 p-2 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-800">设置</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Data Management */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">数据管理</h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800">导出数据</p>
                  <p className="text-xs text-gray-400 mt-0.5">导出为 JSON 文件，含 SHA256 校验</p>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800">导入数据</p>
                  <p className="text-xs text-gray-400 mt-0.5">从 JSON 文件恢复数据，自动校验完整性</p>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>

              <button
                onClick={handleWipe}
                disabled={wiping}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <div className="text-left">
                  <p className={`text-sm font-medium ${wipeConfirm ? 'text-red-600' : 'text-gray-800'}`}>
                    {wipeConfirm ? '确认擦除所有数据？' : '擦除所有数据'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {wipeConfirm ? '此操作不可撤销，点击确认擦除' : '删除所有任务、消息和附件'}
                  </p>
                </div>
                <svg className={`w-4 h-4 ${wipeConfirm ? 'text-red-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {wipeConfirm && (
              <button
                onClick={() => setWipeConfirm(false)}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600"
              >
                取消
              </button>
            )}
          </section>

          {/* About */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">关于</h2>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-800">OpenClaw Agent 通讯平台</p>
              <p className="text-xs text-gray-400 mt-1">版本 v1.0.0 MVP</p>
            </div>
          </section>

          {/* Status */}
          {statusMessage && (
            <div className="text-center text-sm text-gray-500 py-2">
              {statusMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
