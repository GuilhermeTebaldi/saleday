const AUTH0_DOMAIN = (import.meta.env.VITE_AUTH0_DOMAIN || '').trim();
const AUTH0_CLIENT_ID = (import.meta.env.VITE_AUTH0_CLIENT_ID || '').trim();
const AUTH0_AUDIENCE = (import.meta.env.VITE_AUTH0_AUDIENCE || '').trim();
const AUTH0_CONNECTION_APPLE = (import.meta.env.VITE_AUTH0_CONNECTION_APPLE || '').trim();
const AUTH0_CONNECTION_GOOGLE = (import.meta.env.VITE_AUTH0_CONNECTION_GOOGLE || '').trim();
const AUTH0_CONNECTION_FACEBOOK = (import.meta.env.VITE_AUTH0_CONNECTION_FACEBOOK || '').trim();
const AUTH0_SCOPE =
  (import.meta.env.VITE_AUTH0_SCOPE || 'openid profile email offline_access').trim();

const AUTH0_ENABLED = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

const AUTH0_REDIRECT_URI =
  (typeof window !== 'undefined' && window.location?.origin) ||
  import.meta.env.VITE_APP_URL ||
  'http://localhost:5173';

export {
  AUTH0_ENABLED,
  AUTH0_DOMAIN,
  AUTH0_CLIENT_ID,
  AUTH0_AUDIENCE,
  AUTH0_SCOPE,
  AUTH0_REDIRECT_URI,
  AUTH0_CONNECTION_APPLE,
  AUTH0_CONNECTION_GOOGLE,
  AUTH0_CONNECTION_FACEBOOK
};
