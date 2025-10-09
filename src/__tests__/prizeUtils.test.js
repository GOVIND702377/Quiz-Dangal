import { describe, it, expect } from 'vitest';
import { formatPrizeAmount, getPrizeDisplay, describePrizeType } from '@/lib/utils';

describe('formatPrizeAmount', () => {
  it('formats money amounts with rupee prefix and Indian grouping', () => {
    expect(formatPrizeAmount('money', 1234567)).toBe('₹12,34,567');
  });

  it('formats coin amounts with suffix instead of prefix', () => {
    expect(formatPrizeAmount('coins', 2500)).toBe('2,500 coins');
  });

  it('normalises alias names to the configured prize type', () => {
    expect(formatPrizeAmount('coin', 150)).toBe('150 coins');
  });

  it('normalises string inputs that contain currency symbols', () => {
    expect(formatPrizeAmount('money', ' ₹ 3,500 ')).toBe('₹3,500');
  });

  it('uses fallback value when amount is nullish', () => {
    expect(formatPrizeAmount('coins', null, { fallback: 0 })).toBe('0 coins');
  });

  it('appends label when includeLabel flag is true and label missing in base string', () => {
    expect(formatPrizeAmount('others', 3, { includeLabel: true })).toBe('3 rewards');
  });

  it('does not duplicate the label when formatted output already includes it', () => {
    expect(formatPrizeAmount('coins', 500, { includeLabel: true })).toBe('500 coins');
  });

  it('falls back to custom text when amount cannot be parsed', () => {
    expect(formatPrizeAmount('money', undefined, { fallback: 'TBD' })).toBe('₹TBD');
  });
});

describe('getPrizeDisplay', () => {
  it('returns icon, formatted string and helpers for coin prizes', () => {
    const result = getPrizeDisplay('coins', 1500);
    expect(result).toMatchObject({
      icon: '🪙',
      formatted: '1,500 coins',
      value: '1,500',
      prefix: '',
      suffix: ' coins',
      label: 'coins',
      prizeType: 'coins',
      resolvedPrizeType: 'coins',
      showIconSeparately: true,
    });
  });

  it('suppresses duplicate currency icons for money prizes while keeping the symbol in formatted output', () => {
    const display = getPrizeDisplay('money', 500);
    expect(display.icon).toBe('₹');
    expect(display.formatted).toBe('₹500');
    expect(display.showIconSeparately).toBe(false);
  });

  it('uses rupee defaults for unknown prize types', () => {
    const display = getPrizeDisplay('voucher', 200);
    expect(display.icon).toBe('₹');
    expect(display.formatted).toBe('₹200');
    expect(display.value).toBe('200');
    expect(display.label).toBe('cash');
    expect(display.prizeType).toBe('voucher');
    expect(display.resolvedPrizeType).toBe('money');
    expect(display.showIconSeparately).toBe(false);
  });

  it('honours fallback text when amount is missing', () => {
    const display = getPrizeDisplay('coins', undefined, { fallback: 'Soon' });
    expect(display.formatted).toBe('Soon coins');
    expect(display.value).toBe('Soon');
  });
});

describe('describePrizeType', () => {
  it('returns the label for known prize types', () => {
    expect(describePrizeType('coins')).toBe('coins');
  });

  it('normalises aliases when describing prize type', () => {
    expect(describePrizeType('other')).toBe('rewards');
  });

  it('defaults to cash label for unknown types', () => {
    expect(describePrizeType('mystery')).toBe('cash');
  });
});
