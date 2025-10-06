// Lightweight idle prefetch helper (frontend-only). No backend changes.
// Use: prefetch(()=>import('@/pages/Leaderboards'))
// Skips if document hidden or user on data-saver / 2g.
export function prefetch(loader) {
  try {
    if (typeof window === 'undefined') return;
    if (document.visibilityState !== 'visible') return;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      if (conn.saveData) return;
      if (typeof conn.effectiveType === 'string' && /(^|\b)2g(\b|$)/i.test(conn.effectiveType)) return;
    }
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    idle(() => {
      try { loader(); } catch { /* ignore */ }
    });
  } catch { /* swallow */ }
}
