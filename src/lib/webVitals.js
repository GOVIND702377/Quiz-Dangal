// Optional Web Vitals logging (frontend only). Enable via VITE_ENABLE_VITALS=1
// No backend calls; logs to console for diagnostics or future beacon integration.
export async function initWebVitals() {
  try {
    if (!import.meta.env.VITE_ENABLE_VITALS) return;
    const mod = await import('web-vitals');
    const log = (metric) => {
      // Basic formatting; can be extended to sendBeacon later.
      // eslint-disable-next-line no-console
      console.info('[Vitals]', metric.name, Math.round(metric.value), metric);
    };
    mod.onCLS(log);
    mod.onFID(log);
    mod.onLCP(log);
    mod.onINP && mod.onINP(log);
    mod.onTTFB(log);
  } catch {
    // swallow errors silently
  }
}
