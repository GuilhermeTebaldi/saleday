import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

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
    console.error('Global error:', evt.error || evt.message, evt);
  });
  window.addEventListener('unhandledrejection', (evt) => {
    console.error('Unhandled rejection:', evt.reason);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
