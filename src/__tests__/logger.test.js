import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@/lib/logger';

describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not emit info/warn in test (non-dev)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.info('hello');
    logger.warn('heads up');
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('always emits errors', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('boom');
    expect(errSpy).toHaveBeenCalled();
  });
});
