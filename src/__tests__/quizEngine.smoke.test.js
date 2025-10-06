import { describe, it, expect } from 'vitest';

// Smoke import test to ensure hook file and its exported logic parse without runtime side-effects throwing.
// (Deep behavioral tests can be added later.)

describe('useQuizEngine module', () => {
  it('imports without throwing', async () => {
    const mod = await import('@/hooks/useQuizEngine.js');
    expect(typeof mod.useQuizEngine).toBe('function');
  });
});
