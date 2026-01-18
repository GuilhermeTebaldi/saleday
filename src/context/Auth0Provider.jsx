import { Auth0Provider } from '@auth0/auth0-react';
import { AUTH0_CLIENT_ID, AUTH0_DOMAIN, AUTH0_ENABLED, AUTH0_REDIRECT_URI } from '../config/auth0Config.js';

export default function Auth0ProviderWrapper({ children }) {
  if (!AUTH0_ENABLED) {
    return children;
  }

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      cacheLocation="localstorage"
      useRefreshTokens
      authorizationParams={{
        redirect_uri: AUTH0_REDIRECT_URI,
        scope: 'openid profile email'
      }}
    >
      {children}
    </Auth0Provider>
  );
}
