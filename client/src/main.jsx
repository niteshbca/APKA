import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyAccent, savedAccent } from './utils/theme';
import './index.css';

// Apply the saved brand accent before first paint.
applyAccent(savedAccent());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const hadController = !!navigator.serviceWorker.controller;
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || refreshing) return;
        refreshing = true;
        window.location.reload();
      });
      const reg = await navigator.serviceWorker.register('/sw.js');
      reg.update();
      setInterval(() => reg.update(), 60 * 60 * 1000);
    } catch (err) {
      console.warn('SW registration failed:', err);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
