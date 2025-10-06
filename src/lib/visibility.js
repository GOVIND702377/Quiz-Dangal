// Visibility helpers (SSR safe)
function isDocumentHidden() {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'hidden';
}

function onVisibilityChange(handler) {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

export { isDocumentHidden, onVisibilityChange };
