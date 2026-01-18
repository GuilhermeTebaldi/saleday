import { useEffect, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export default function Auth0LoginActions({ onLoginSuccess, onLoginError, renderButtons, className = '' }) {
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
        if (claims?.email_verified === false) {
          throw new Error('Confirme o e-mail no Auth0 antes de continuar.');
        }
        processedRef.current = true;
        onLoginSuccess?.({
          user: {
            id: claims?.sub,
            email: claims?.email,
            username: claims?.nickname || claims?.name || claims?.email,
            name: claims?.name
          },
          token: idToken
        });
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

  const handleAuth0Login = (connection) => {
    setBackendError('');
    const options = connection ? { authorizationParams: { connection } } : undefined;
    loginWithRedirect(options).catch(() => {
      if (mountedRef.current) {
        setBackendError('Não foi possível iniciar o login pelo Auth0.');
      }
    });
  };

  const isBusy = isLoading || syncing;
  const errorMessage = backendError || error?.message || '';

  if (renderButtons) {
    return (
      <div className={`auth0-actions ${className}`.trim()}>
        {renderButtons({ onLogin: handleAuth0Login, isBusy, errorMessage })}
      </div>
    );
  }

  return (
    <div className={`auth0-actions ${className}`.trim()}>
      <button type="button" className="btn-secondary" onClick={() => handleAuth0Login()} disabled={isBusy}>
        {isBusy ? 'Autenticando...' : 'Entrar com Auth0'}
      </button>
      {errorMessage && (
        <p className="form-error" aria-live="polite">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
