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