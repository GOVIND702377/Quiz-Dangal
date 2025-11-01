import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDocumentHidden, onVisibilityChange } from '@/lib/visibility';

describe('visibility helpers', () => {
  const originalDocument = global.document;

  beforeEach(() => {
    // Minimal mock document
    global.document = {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  it('isDocumentHidden returns false when document.visibilityState is visible', () => {
    document.visibilityState = 'visible';
    expect(isDocumentHidden()).toBe(false);
  });

  it('isDocumentHidden returns true when document.visibilityState is hidden', () => {
    document.visibilityState = 'hidden';
    expect(isDocumentHidden()).toBe(true);
  });

  it('onVisibilityChange registers and returns an unsubscribe function', () => {
    const handler = vi.fn();
    const off = onVisibilityChange(handler);
    expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', handler);
    expect(typeof off).toBe('function');
    off();
    expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', handler);
  });
});
