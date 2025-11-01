import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prefetchRoute } from '@/lib/utils';

describe('utils: prefetchRoute', () => {
  const originalRIC = window.requestIdleCallback;
  let timeoutSpy;

  beforeEach(() => {
    timeoutSpy = vi.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    timeoutSpy.mockRestore();
    window.requestIdleCallback = originalRIC;
  });

  it('uses requestIdleCallback when available', () => {
    const cbSpy = vi.fn((cb) => cb());
    // @ts-ignore
    window.requestIdleCallback = cbSpy;
    expect(() => prefetchRoute('/')).not.toThrow();
    expect(cbSpy).toHaveBeenCalled();
  });

  it('falls back to setTimeout when requestIdleCallback missing', () => {
    // @ts-ignore
    delete window.requestIdleCallback;
    expect(() => prefetchRoute('/home')).not.toThrow();
    expect(timeoutSpy).toHaveBeenCalled();
  });

  it('is no-op for unknown routes', () => {
    expect(() => prefetchRoute('/not-a-route')).not.toThrow();
  });
});
