const MAX_ERRORS = 12;
const listeners = new Set();
const pauseListeners = new Set();
let errors = [];
let overlayPaused = true;

const getOverlayFlag = () => {
  if (typeof window !== 'undefined' && window.SHOW_ERROR_OVERLAY === true) {
    return true;
  }
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV !== 'production';
  }
  return true;
};

export const overlayEnabled = getOverlayFlag();

const notifyListeners = () => {
  const snapshot = errors.slice(-MAX_ERRORS);
  listeners.forEach((listener) => listener(snapshot));
};

export const addOverlayError = (payload) => {
  const normalized = {
    timestamp: Date.now(),
    type: payload.type || 'global',
    message: payload.message || 'Erro inesperado',
    stack: payload.stack ?? payload.error?.stack ?? null,
    meta: payload.meta || {}
  };

  errors = [...errors, normalized].slice(-MAX_ERRORS);
  notifyListeners();
};

export const logOverlayError = (payload) => {
  addOverlayError({
    type: payload?.type || 'manual',
    message: payload?.message || (payload?.error?.message ?? 'Erro manual registrado'),
    stack: payload?.stack ?? payload?.error?.stack ?? null,
    meta: payload?.meta ?? payload
  });
};

export const subscribeErrorOverlay = (listener) => {
  listeners.add(listener);
  listener(errors.slice(-MAX_ERRORS));
  return () => listeners.delete(listener);
};

export const subscribeOverlayPause = (listener) => {
  pauseListeners.add(listener);
  listener(overlayPaused);
  return () => pauseListeners.delete(listener);
};

export const setOverlayPaused = (value) => {
  overlayPaused = !!value;
  pauseListeners.forEach((listener) => listener(overlayPaused));
};
