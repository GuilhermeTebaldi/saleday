import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

if (typeof window !== 'undefined') {
  window.addEventListener('error', (evt) => {
    console.error('Global error:', evt.error || evt.message, evt);
  });
  window.addEventListener('unhandledrejection', (evt) => {
    console.error('Unhandled rejection:', evt.reason);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
