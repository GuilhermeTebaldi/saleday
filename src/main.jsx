import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';
import ErrorOverlay from './components/ErrorOverlay.jsx';
import { addOverlayError, logOverlayError, setOverlayPaused } from './utils/errorOverlayStore.js';

if (typeof window !== 'undefined') {
  try {
    const userRaw = localStorage.getItem('user');
    if (userRaw) JSON.parse(userRaw);
  } catch (err) {
    console.warn('[Init] Corrompido, limpando localStorage/indexedDB', err);
    localStorage.clear();
    if (typeof indexedDB !== 'undefined' && indexedDB?.databases) {
      indexedDB
        .databases()
        .then((dbs) => dbs.forEach((db) => indexedDB.deleteDatabase(db.name)))
        .catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }

  window.addEventListener('error', (evt) => {
    const message = evt.error?.message || evt.message || 'Erro global não identificado';
    const stack = evt.error?.stack || `${evt.filename}:${evt.lineno}:${evt.colno}`;
    console.error('Global error:', evt.error || evt.message, evt);
    addOverlayError({
      type: 'global',
      message,
      stack,
      meta: { filename: evt.filename, lineno: evt.lineno, colno: evt.colno }
    });
  });
  window.addEventListener('unhandledrejection', (evt) => {
    const reason = evt.reason;
    const message = reason?.message || String(reason);
    const stack = reason?.stack || '';
    console.error('Unhandled rejection:', evt.reason);
    addOverlayError({
      type: 'unhandledrejection',
      message,
      stack,
      meta: { reason }
    });
  });
  window.logOverlayError = (payload) => logOverlayError(payload);
  window.hideErrorOverlay = () => setOverlayPaused(true);
  window.showErrorOverlay = () => setOverlayPaused(false);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
    <ErrorOverlay />
  </>
);
