interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onOpenSettings?: () => void;
}

export function Header({ title, onToggleSidebar, sidebarOpen, onOpenSettings }: HeaderProps) {
  return (
    <header className="flex items-center h-14 px-4 border-b border-gray-200 bg-white shrink-0 z-20">
      <button
        onClick={onToggleSidebar}
        className="mr-3 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
        aria-label={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
      <h1 className="flex-1 text-base font-semibold text-gray-800 truncate">{title}</h1>
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="设置"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      )}
    </header>
  );
}
