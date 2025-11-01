import { describe, it, expect } from 'vitest';
import { formatDateTime, formatDateOnly, formatTimeOnly, toDatetimeLocalValue } from '@/lib/utils';

describe('utils: date/time formatters', () => {
  const sample = new Date('2024-03-15T10:20:00.000Z');

  it('formatDateTime returns IST and is resilient', () => {
    const out = formatDateTime(sample);
    expect(out).toMatch(/15 Mar 2024/i);
    expect(out).toMatch(/IST$/);
    expect(formatDateTime(null)).toBe('—');
  });

  it('formatDateOnly returns date in IST', () => {
    const out = formatDateOnly(sample);
    expect(out).toMatch(/15 Mar 2024/i);
    expect(formatDateOnly(undefined)).toBe('—');
  });

  it('formatTimeOnly returns time in IST', () => {
    const out = formatTimeOnly(sample);
    // e.g., "03:50 PM" depending on IST offset; just assert structure HH:MM AM/PM
    expect(out).toMatch(/\d{2}:\d{2}\s?(AM|PM)/i);
    expect(formatTimeOnly('bad-value')).toBe('bad-value');
  });

  it('toDatetimeLocalValue formats for input[type=datetime-local]', () => {
    const d = new Date('2024-01-02T03:04:05.000Z');
    const val = toDatetimeLocalValue(d);
    expect(val).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(toDatetimeLocalValue(null)).toBe('');
  });
});
