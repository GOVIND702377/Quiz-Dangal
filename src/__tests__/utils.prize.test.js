import { describe, it, expect } from 'vitest';
import { formatPrizeAmount, getPrizeDisplay, describePrizeType } from '@/lib/utils';

describe('utils: prize helpers', () => {
  it('formats money with INR prefix and label option', () => {
    expect(formatPrizeAmount('money', 12345)).toBe('₹12,345');
    expect(formatPrizeAmount('money', '12000', { includeLabel: true })).toBe('₹12,000 cash');
  });

  it('normalizes aliases and formats coins', () => {
    expect(formatPrizeAmount('rupees', 5000)).toBe('₹5,000');
    expect(formatPrizeAmount('coins', 250)).toBe('250 coins');
    expect(formatPrizeAmount('token', '  75  ')).toBe('75 coins');
  });

  it('handles invalid/empty gracefully with fallback', () => {
    expect(formatPrizeAmount('money', null, { fallback: '0' })).toBe('₹0');
    // unknown type falls back to money meta; non-numeric like 'abc' sanitizes to 0
    expect(formatPrizeAmount('unknownType', 'abc', { fallback: 'N/A' })).toBe('₹0');
  });

  it('getPrizeDisplay returns structured info', () => {
    const d = getPrizeDisplay('money', 9999);
    expect(d.icon).toBe('₹');
    expect(d.formatted).toBe('₹9,999');
    expect(d.value).toBe('9,999');
    expect(d.resolvedPrizeType).toBe('money');
  });

  it('describePrizeType returns readable label', () => {
    expect(describePrizeType('coins')).toBe('coins');
    expect(describePrizeType('gift')).toBe('rewards');
  });
});
