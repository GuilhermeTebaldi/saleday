const AUTH0_DOMAIN = (import.meta.env.VITE_AUTH0_DOMAIN || '').trim();
const AUTH0_CLIENT_ID = (import.meta.env.VITE_AUTH0_CLIENT_ID || '').trim();
const AUTH0_AUDIENCE = (import.meta.env.VITE_AUTH0_AUDIENCE || '').trim();

const AUTH0_ENABLED = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID && AUTH0_AUDIENCE);

const AUTH0_REDIRECT_URI =
  (typeof window !== 'undefined' && window.location?.origin) ||
  import.meta.env.VITE_APP_URL ||
  'http://localhost:5173';

export {
  AUTH0_ENABLED,
  AUTH0_DOMAIN,
  AUTH0_CLIENT_ID,
  AUTH0_AUDIENCE,
  AUTH0_REDIRECT_URI
};
