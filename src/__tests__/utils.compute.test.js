import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldAllowClientCompute, safeComputeResultsIfDue } from '@/lib/utils';

describe('utils: client compute flags and RPC', () => {
  beforeEach(() => {
    // Reset flag before each
    import.meta.env.VITE_ALLOW_CLIENT_COMPUTE = undefined;
    import.meta.env.VITE_ENABLE_CLIENT_COMPUTE = '0';
    sessionStorage.clear();
  });

  it('shouldAllowClientCompute respects env flags with defaults', () => {
    expect(shouldAllowClientCompute({ defaultValue: true })).toBe(true);
    expect(shouldAllowClientCompute({ defaultValue: false })).toBe(false);

    import.meta.env.VITE_ALLOW_CLIENT_COMPUTE = 'yes';
    expect(shouldAllowClientCompute({ defaultValue: false })).toBe(true);

    import.meta.env.VITE_ALLOW_CLIENT_COMPUTE = 'off';
    expect(shouldAllowClientCompute({ defaultValue: true })).toBe(false);

    import.meta.env.VITE_ALLOW_CLIENT_COMPUTE = 'unknown';
    expect(shouldAllowClientCompute({ defaultValue: true })).toBe(true);
  });

  it('safeComputeResultsIfDue returns false when disabled', async () => {
    const mockSb = { rpc: vi.fn() };
    const ok = await safeComputeResultsIfDue(mockSb, 'quiz-1');
    expect(ok).toBe(false);
    expect(mockSb.rpc).not.toHaveBeenCalled();
  });

  it('safeComputeResultsIfDue calls RPC once when enabled and sets session flag', async () => {
    import.meta.env.VITE_ENABLE_CLIENT_COMPUTE = '1';
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const mockSb = { rpc };

    const key = 'qd_compute_done_quiz-2';
    expect(sessionStorage.getItem(key)).toBeNull();

    const ok1 = await safeComputeResultsIfDue(mockSb, 'quiz-2', { throttleMs: 1 });
    expect(ok1).toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(key)).toBe('1');

    const ok2 = await safeComputeResultsIfDue(mockSb, 'quiz-2');
    expect(ok2).toBe(false); // already done in this session
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('safeComputeResultsIfDue suppresses 404-like errors and returns false', async () => {
    import.meta.env.VITE_ENABLE_CLIENT_COMPUTE = 'true';
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'function compute_results_if_due does not exist' } });
    const mockSb = { rpc };
    const ok = await safeComputeResultsIfDue(mockSb, 'quiz-3');
    expect(ok).toBe(false);
    expect(rpc).toHaveBeenCalledOnce();
  });
});
