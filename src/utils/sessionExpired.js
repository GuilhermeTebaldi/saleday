const SESSION_EXPIRED_KEY = 'templesale.sessionExpired';

export const markSessionExpired = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSION_EXPIRED_KEY, String(Date.now()));
  } catch {
    // ignore storage failures
  }
};

export const clearSessionExpired = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_EXPIRED_KEY);
  } catch {
    // ignore storage failures
  }
};

export const isSessionExpired = () => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(SESSION_EXPIRED_KEY));
  } catch {
    return false;
  }
};
