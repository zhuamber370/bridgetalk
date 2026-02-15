import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './i18n'; // Import i18n configuration

// Capture unhandled errors and show them on screen for debugging
window.onerror = (msg, src, line, col, err) => {
  showError(`${msg}\n${src}:${line}:${col}\n${err?.stack ?? ''}`);
};
window.onunhandledrejection = (e) => {
  showError(`Unhandled rejection: ${e.reason?.message ?? e.reason}\n${e.reason?.stack ?? ''}`);
};

function showError(text: string) {
  const el = document.getElementById('__error_overlay');
  if (el) {
    el.style.display = 'block';
    el.textContent += text + '\n\n';
  } else {
    const div = document.createElement('div');
    div.id = '__error_overlay';
    div.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;color:#c00;padding:24px;overflow:auto;font:13px/1.5 monospace;white-space:pre-wrap';
    div.textContent = text;
    document.body.appendChild(div);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
