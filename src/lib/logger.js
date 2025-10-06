// Lightweight logger (frontend only). No backend change required.
// Provides consistent logging with environment guard for non-critical info.
// Errors always reported to console.error for visibility.

const isDev = import.meta.env.DEV;

function format(level, args) {
  try {
    const ts = new Date().toISOString();
    return [`[${ts}] [${level}]`, ...args];
  } catch {
    return [`[log:${level}]`, ...args];
  }
}

export const logger = {
  info: (...args) => {
    if (!isDev) return; // info only in dev
    // eslint-disable-next-line no-console
    console.log(...format('info', args));
  },
  warn: (...args) => {
    if (!isDev) return; // suppress non-critical warns in prod
    // eslint-disable-next-line no-console
    console.warn(...format('warn', args));
  },
  error: (...args) => {
    // Always log errors
    // eslint-disable-next-line no-console
    console.error(...format('error', args));
  },
};
