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

const truthyClientComputeFlags = new Set(['1', 'true', 'yes', 'on', 'auto', 'enabled']);
const falsyClientComputeFlags = new Set(['0', 'false', 'no', 'off', 'disabled']);

export function shouldAllowClientCompute(options = {}) {
	const { defaultValue = true } = options || {};
	try {
		const raw = import.meta?.env?.VITE_ALLOW_CLIENT_COMPUTE;
		if (raw === undefined || raw === null) return defaultValue;
		const normalized = String(raw).trim().toLowerCase();
		if (!normalized) return defaultValue;
		if (truthyClientComputeFlags.has(normalized)) return true;
		if (falsyClientComputeFlags.has(normalized)) return false;
		return defaultValue;
	} catch {
		return defaultValue;
	}
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

// --- Prize helpers ---
const PRIZE_TYPE_META = {
	money: { icon: '₹', prefix: '₹', suffix: '', label: 'cash' },
	coins: { icon: '🪙', prefix: '', suffix: ' coins', label: 'coins' },
	others: { icon: '🎁', prefix: '', suffix: '', label: 'rewards' },
};

const PRIZE_TYPE_ALIASES = {
	rupee: 'money',
	rupees: 'money',
	cash: 'money',
	inr: 'money',
	coin: 'coins',
	token: 'coins',
	tokens: 'coins',
	reward: 'others',
	rewards: 'others',
	other: 'others',
	gift: 'others',
};

const defaultPrizeMeta = PRIZE_TYPE_META.money;

const normalizePrizeType = (prizeType = 'money') => {
	if (prizeType === null || prizeType === undefined) return 'money';
	const raw = String(prizeType).trim().toLowerCase();
	if (!raw) return 'money';
	if (PRIZE_TYPE_META[raw]) return raw;
	if (PRIZE_TYPE_ALIASES[raw]) return PRIZE_TYPE_ALIASES[raw];
	return 'money';
};

const sanitizePrizeValue = (value) => {
	if (value === null || value === undefined) return null;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	const trimmed = String(value).trim();
	if (!trimmed) return null;
	const numeric = Number(trimmed.replace(/[^0-9.]/g, ''));
	return Number.isFinite(numeric) ? numeric : trimmed;
};

export function getPrizeTypeMeta(prizeType = 'money') {
	const normalized = normalizePrizeType(prizeType);
	return PRIZE_TYPE_META[normalized] || defaultPrizeMeta;
}

export function formatPrizeAmount(prizeType, amount, options = {}) {
	const resolvedType = normalizePrizeType(prizeType);
	const meta = getPrizeTypeMeta(resolvedType);
	const { fallback = '0', includeLabel = false } = options;
	const sanitized = sanitizePrizeValue(amount);
	const raw = sanitized ?? fallback;
	const numeric = typeof raw === 'number' ? raw : Number(raw);
	const displayValue = Number.isFinite(numeric)
		? numeric.toLocaleString('en-IN')
		: String(raw);
	const formatted = `${meta.prefix || ''}${displayValue}${meta.suffix || ''}`.trim();
	if (includeLabel && meta.label) {
		const formattedLower = formatted.toLowerCase();
		if (!formattedLower.endsWith(meta.label.toLowerCase())) {
			return `${formatted} ${meta.label}`.trim();
		}
	}
	return formatted;
}

export function getPrizeDisplay(prizeType, amount, options = {}) {
	const resolvedPrizeType = normalizePrizeType(prizeType);
	const meta = getPrizeTypeMeta(resolvedPrizeType);
	const { fallback = '0' } = options;
	const sanitized = sanitizePrizeValue(amount);
	const raw = sanitized ?? fallback;
	const numeric = typeof raw === 'number' ? raw : Number(raw);
	const value = Number.isFinite(numeric)
		? numeric.toLocaleString('en-IN')
		: String(raw);
	const formatted = `${meta.prefix || ''}${value}${meta.suffix || ''}`.trim();
	const showIconSeparately = Boolean((meta.icon || '').trim() && (meta.prefix || '').trim() !== (meta.icon || '').trim());
	return {
		icon: meta.icon,
		formatted,
		value,
		prefix: meta.prefix || '',
		suffix: meta.suffix || '',
		label: meta.label,
		prizeType: typeof prizeType === 'string' && prizeType.trim() ? prizeType : resolvedPrizeType,
		resolvedPrizeType,
		showIconSeparately,
	};
}

export function describePrizeType(prizeType) {
	return getPrizeTypeMeta(prizeType).label;
}