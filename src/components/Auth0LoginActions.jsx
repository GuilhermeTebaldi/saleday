import { useEffect, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import api from '../api/api.js';

export default function Auth0LoginActions({ onLoginSuccess, onLoginError }) {
  const { loginWithRedirect, getIdTokenClaims, isAuthenticated, isLoading, error } = useAuth0();
  const [backendError, setBackendError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const processedRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      processedRef.current = false;
      setBackendError('');
      return;
    }
    if (processedRef.current || syncing) {
      return;
    }

    const exchangeToken = async () => {
      setSyncing(true);
      try {
        const claims = await getIdTokenClaims();
        const idToken = claims?.__raw;
        if (!idToken) {
          throw new Error('Não foi possível recuperar o token do Auth0.');
        }
        const response = await api.post('/auth/auth0', { idToken });
        processedRef.current = true;
        onLoginSuccess?.(response.data.data);
      } catch (err) {
        const message =
          err?.response?.data?.message || err?.message || 'Não foi possível validar o login pelo Auth0.';
        if (mountedRef.current) {
          setBackendError(message);
        }
        onLoginError?.(message);
      } finally {
        if (mountedRef.current) {
          setSyncing(false);
        }
      }
    };

    exchangeToken();
  }, [isAuthenticated, getIdTokenClaims, onLoginError, onLoginSuccess, syncing]);

  const handleAuth0Login = () => {
    setBackendError('');
    loginWithRedirect().catch(() => {
      if (mountedRef.current) {
        setBackendError('Não foi possível iniciar o login pelo Auth0.');
      }
    });
  };

  return (
    <div className="auth0-actions">
      <button
        type="button"
        className="btn-secondary"
        onClick={handleAuth0Login}
        disabled={isLoading || syncing}
      >
        {isLoading || syncing ? 'Autenticando...' : 'Entrar com Auth0'}
      </button>
      {(backendError || error?.message) && (
        <p className="form-error" aria-live="polite">
          {backendError || error.message}
        </p>
      )}
    </div>
  );
}
