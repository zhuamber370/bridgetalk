import { useState } from 'react';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import './styles/index.css';

export function App() {
  const [page, setPage] = useState<'chat' | 'settings'>('chat');

  if (page === 'settings') {
    return <SettingsPage onBack={() => setPage('chat')} />;
  }

  return <ChatPage onOpenSettings={() => setPage('settings')} />;
}
