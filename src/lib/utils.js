import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

// Format a timestamp (ISO string or Date) to India time consistently
export function formatDateTime(value, opts = {}) {
	if (!value) return '—';
	try {
		const d = value instanceof Date ? value : new Date(value);
		const formatter = new Intl.DateTimeFormat('en-IN', {
			day: '2-digit', month: 'short', year: 'numeric',
			hour: '2-digit', minute: '2-digit', hour12: true,
			timeZone: opts.timeZone || 'Asia/Kolkata'
		});
		return formatter.format(d) + ' IST';
	} catch {
		return typeof value === 'string' ? value : '—';
	}
}

// Date only (IST)
export function formatDateOnly(value, opts = {}) {
	if (!value) return '—';
	try {
		const d = value instanceof Date ? value : new Date(value);
		const formatter = new Intl.DateTimeFormat('en-IN', {
			day: '2-digit', month: 'short', year: 'numeric',
			timeZone: opts.timeZone || 'Asia/Kolkata'
		});
		return formatter.format(d);
	} catch {
		return typeof value === 'string' ? value : '—';
	}
}

// Time only (IST)
export function formatTimeOnly(value, opts = {}) {
	if (!value) return '—';
	try {
		const d = value instanceof Date ? value : new Date(value);
		const formatter = new Intl.DateTimeFormat('en-IN', {
			hour: '2-digit', minute: '2-digit', hour12: true,
			timeZone: opts.timeZone || 'Asia/Kolkata'
		});
		return formatter.format(d);
	} catch {
		return typeof value === 'string' ? value : '—';
	}
}

// --- Route Prefetch Helper (dynamic import warming) ---
// Map route paths to lazy page importers so we can prefetch on hover/focus.
const routePrefetchMap = {
	'/wallet': () => import('@/pages/Wallet'),
	'/profile': () => import('@/pages/Profile'),
	'/leaderboards': () => import('@/pages/Leaderboards'),
	'/my-quizzes': () => import('@/pages/MyQuizzes'),
};

const warmed = new Set();
export function prefetchRoute(path) {
	try {
		const loader = routePrefetchMap[path];
		if (!loader || warmed.has(path)) return;
		// Use requestIdleCallback if available to avoid jank
		const run = () => loader().catch(() => {});
		if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
			window.requestIdleCallback(() => { run(); warmed.add(path); });
		} else {
			setTimeout(() => { run(); warmed.add(path); }, 120);
		}
	} catch (e) { /* prefetch route failed – non critical */ }
}

// For HTML <input type="datetime-local"> value attribute (local time, YYYY-MM-DDTHH:mm)
export function toDatetimeLocalValue(value) {
	if (!value) return '';
	try {
		const d = value instanceof Date ? value : new Date(value);
		const pad = (n) => String(n).padStart(2, '0');
		const yyyy = d.getFullYear();
		const mm = pad(d.getMonth() + 1);
		const dd = pad(d.getDate());
		const hh = pad(d.getHours());
		const mi = pad(d.getMinutes());
		return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
	} catch {
		return '';
	}
}