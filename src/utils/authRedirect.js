export const sanitizeNextPath = (value, fallback = '/') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }
  return trimmed;
};

export const buildLoginUrl = (nextPath) =>
  `/login?next=${encodeURIComponent(sanitizeNextPath(nextPath))}`;
