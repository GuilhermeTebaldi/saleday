import { useEffect, useMemo, useState } from 'react';
import { overlayEnabled, subscribeErrorOverlay } from '../utils/errorOverlayStore.js';

const MAX_DISPLAY_ERRORS = 4;

export default function ErrorOverlay({ enabled = overlayEnabled }) {
  const [errors, setErrors] = useState([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeErrorOverlay((next) => {
      setErrors(next.slice(-MAX_DISPLAY_ERRORS));
      setVisible(() => next.length > 0);
    });
  }, [enabled]);

  const latestError = useMemo(() => errors[errors.length - 1], [errors]);

  const handleCopy = async () => {
    if (!latestError) return;
    const payload = JSON.stringify(
      {
        type: latestError.type,
        message: latestError.message,
        stack: latestError.stack,
        meta: latestError.meta
      },
      null,
      2
    );
    try {
      await navigator.clipboard?.writeText(payload);
    } catch {
      console.warn('[ErrorOverlay] copy failed');
    }
  };

  if (!enabled || !visible || !latestError) {
    return null;
  }

  return (
    <div
      data-testid="error-overlay"
      style={{
        position: 'fixed',
        inset: 'auto 1rem 1rem 1rem',
        zIndex: 9999,
        borderRadius: '0.5rem',
        padding: '1rem',
        background:
          'linear-gradient(180deg, rgba(244,67,54,0.95), rgba(33,33,33,0.95))',
        color: '#fff',
        boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        maxWidth: 'min(95vw, 360px)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.95rem' }}>{latestError.type}</strong>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleCopy}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: '#fff',
              padding: '0.25rem 0.6rem',
              borderRadius: '0.35rem',
              cursor: 'pointer'
            }}
          >
            Copiar
          </button>
          <button
            onClick={() => setVisible(false)}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: '#fff',
              padding: '0.25rem 0.6rem',
              borderRadius: '0.35rem',
              cursor: 'pointer'
            }}
          >
            Fechar
          </button>
        </div>
      </div>
      <p style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.8rem', lineHeight: '1.4' }}>
        {latestError.message}
      </p>
      {latestError.stack && (
        <pre
          style={{
            maxHeight: '120px',
            overflow: 'auto',
            fontSize: '0.65rem',
            lineHeight: '1.2',
            background: 'rgba(0,0,0,0.3)',
            margin: '0.25rem 0 0',
            padding: '0.5rem',
            borderRadius: '0.35rem'
          }}
        >
          {latestError.stack}
        </pre>
      )}
      {errors.length > 1 && (
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.6rem', opacity: 0.75 }}>
          {errors.length} erros registrados (use `window.logOverlayError()` para adicionar mais)
        </p>
      )}
    </div>
  );
}
