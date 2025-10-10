import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { normalizeReferralCode, saveReferralCode, loadReferralCode, clearReferralCode, REFERRAL_STORAGE_KEY } from '@/lib/referralStorage';

const createStorage = (backingMap) => ({
  getItem: (key) => (backingMap.has(key) ? backingMap.get(key) : null),
  setItem: (key, value) => { backingMap.set(key, String(value)); },
  removeItem: (key) => { backingMap.delete(key); },
  clear: () => { backingMap.clear(); },
});

describe('referralStorage helpers', () => {
  let sessionMap;
  let localMap;

  beforeEach(() => {
    sessionMap = new Map();
    localMap = new Map();
    global.window = {
      sessionStorage: createStorage(sessionMap),
      localStorage: createStorage(localMap),
    };
  });

  afterEach(() => {
    delete global.window;
  });

  test('normalizeReferralCode trims, strips spaces, and uppercases', () => {
    expect(normalizeReferralCode('  abc  ')).toBe('ABC');
    expect(normalizeReferralCode('a b c')).toBe('ABC');
    expect(normalizeReferralCode('\nref-123\t')).toBe('REF-123');
    expect(normalizeReferralCode('')).toBe('');
    expect(normalizeReferralCode()).toBe('');
  });

  test('saveReferralCode stores normalized value in both storage layers', () => {
    const stored = saveReferralCode(' ab12 ');
    expect(stored).toBe('AB12');
    expect(sessionMap.get(REFERRAL_STORAGE_KEY)).toBe('AB12');
    expect(localMap.get(REFERRAL_STORAGE_KEY)).toBe('AB12');
  });

  test('loadReferralCode prefers sessionStorage but falls back to localStorage', () => {
    localMap.set(REFERRAL_STORAGE_KEY, ' fallback ');
    expect(loadReferralCode()).toBe('FALLBACK');

    sessionMap.set(REFERRAL_STORAGE_KEY, ' session ');
    expect(loadReferralCode()).toBe('SESSION');
  });

  test('clearReferralCode removes values from both storage layers', () => {
    saveReferralCode('xyz');
    clearReferralCode();
    expect(sessionMap.has(REFERRAL_STORAGE_KEY)).toBe(false);
    expect(localMap.has(REFERRAL_STORAGE_KEY)).toBe(false);
  });

  test('saveReferralCode returns empty string for invalid input without touching storage', () => {
    const stored = saveReferralCode('   ');
    expect(stored).toBe('');
    expect(sessionMap.size).toBe(0);
    expect(localMap.size).toBe(0);
  });
});
