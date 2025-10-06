import { describe, it, expect } from 'vitest';
import { escapeHTML, rateLimit, debounce } from '@/lib/security';

describe('escapeHTML', () => {
  it('escapes basic characters', () => {
    expect(escapeHTML('<script>"test" & more</script>')).toBe('&lt;script&gt;&quot;test&quot; &amp; more&lt;/script&gt;');
  });
  it('returns empty string for undefined', () => {
    expect(escapeHTML()).toBe('');
  });
});

describe('rateLimit', () => {
  it('allows first calls within window', () => {
    const key = 'test-key';
    for (let i = 0; i < 5; i++) {
      const res = rateLimit(key, { max: 5, windowMs: 1000 });
      if (i < 5) expect(res.allowed).toBe(true);
    }
    const blocked = rateLimit('test-key', { max: 5, windowMs: 1000 });
    expect(blocked.allowed).toBe(false);
  });
});

describe('debounce', () => {
  it('debounces calls (executes last)', async () => {
    return new Promise((resolve) => {
      let count = 0;
      const fn = () => { count += 1; resolve(expect(count).toBe(1)); };
      const d = debounce(fn, 50);
      d(); d(); d();
    });
  });
});
