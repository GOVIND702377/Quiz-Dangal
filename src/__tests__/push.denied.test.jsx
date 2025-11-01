import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Minimal auth context shim for the hook
vi.mock('@/contexts/SupabaseAuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

// Mock Supabase client config used by the hook (not reached in denied flow)
vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: { rpc: vi.fn() },
  hasSupabaseConfig: true,
}));

function TestComp() {
  const { subscribeToPush, error } = usePushNotifications();
  return (
    <button onClick={() => subscribeToPush()} aria-label="trigger">
      {error || 'ok'}
    </button>
  );
}

describe('usePushNotifications: denied permission', () => {
  it('returns false and sets error when Notification.permission is denied', async () => {
    // Simulate browser APIs
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'denied', requestPermission: vi.fn() },
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: {
        serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn(() => Promise.resolve(null)) } }) },
      },
      configurable: true,
    });
    Object.defineProperty(window, 'PushManager', { value: function() {}, configurable: true });

    render(<TestComp />);

    // Click and assert it shows denied message
    await act(async () => {
      screen.getByRole('button', { name: 'trigger' }).click();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'trigger' }).textContent).toMatch(/permission was denied/i);
  });
});
