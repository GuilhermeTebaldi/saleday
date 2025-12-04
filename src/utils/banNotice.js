let listener = null;
let currentReason = null;

export function registerBanReasonListener(callback) {
  listener = callback;
  if (typeof callback === 'function') {
    callback(currentReason);
  }
  return () => {
    if (listener === callback) {
      listener = null;
    }
  };
}

export function notifyBanReason(reason) {
  currentReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
  if (typeof listener === 'function') {
    listener(currentReason);
  }
}

export function clearBanReason() {
  notifyBanReason(null);
}
