const CLOCK_SKEW_MS = 5000;

export const isAuth0IdTokenExpired = (claims, skewMs = CLOCK_SKEW_MS) => {
  if (!claims?.exp) return false;
  return claims.exp * 1000 <= Date.now() + skewMs;
};

export async function getFreshAuth0IdToken({
  getAccessTokenSilently,
  getIdTokenClaims,
  authorizationParams = {},
  onLoginRequired
}) {
  const silentOptions = {
    detailedResponse: true,
    authorizationParams: { ...authorizationParams }
  };

  try {
    const result = await getAccessTokenSilently(silentOptions);
    if (result && typeof result === 'object' && 'id_token' in result && result.id_token) {
      return result.id_token;
    }

    const refreshedClaims = await getIdTokenClaims();
    if (refreshedClaims?.__raw && !isAuth0IdTokenExpired(refreshedClaims)) {
      return refreshedClaims.__raw;
    }
  } catch (err) {
    const requiresLogin =
      err?.error === 'login_required' ||
      err?.error === 'consent_required' ||
      err?.error === 'missing_refresh_token' ||
      err?.error === 'invalid_grant';

    if (requiresLogin && typeof onLoginRequired === 'function') {
      await onLoginRequired(err);
      return null;
    }

    throw err;
  }

  const cachedClaims = await getIdTokenClaims();
  if (cachedClaims?.__raw && !isAuth0IdTokenExpired(cachedClaims)) {
    return cachedClaims.__raw;
  }

  if (typeof onLoginRequired === 'function') {
    await onLoginRequired(new Error('id_token_expired'));
  }

  return null;
}
