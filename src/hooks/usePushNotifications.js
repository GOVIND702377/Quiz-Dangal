import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase, hasSupabaseConfig } from '@/lib/customSupabaseClient';
import { logger } from '@/lib/logger';

// Read VAPID key from env; do not hardcode in source.
const VAPID_PUBLIC_KEY = (import.meta?.env?.VITE_VAPID_PUBLIC_KEY || '').trim();

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth?.() || { user: null };
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(sub => {
          if (sub) {
            setIsSubscribed(true);
            setSubscription(sub);
          }
        });
      });
    }
  }, []);

  const subscribeToPush = async () => {
    // Require login to bind subscription with user in DB (RLS-safe)
    if (!user) {
      setError('Notifications ke liye pehle login karein.');
      return false;
    }
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      setError('Push notifications are not supported by this browser.');
      return false;
    }

    try {
      // Always ask for permission first so the native browser prompt can appear
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          setError('Notifications permission was denied.');
          return false;
        }
      }

      // After permission granted, validate server/client config for push subscription
      if (!VAPID_PUBLIC_KEY) {
        setError('Push key not configured. Set VITE_VAPID_PUBLIC_KEY in your .env');
        return false;
      }
      if (!hasSupabaseConfig || !supabase) {
        setError('Server is not configured for push. Supabase credentials missing.');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const { error: rpcError } = await supabase.rpc('save_push_subscription', {
        p_subscription_object: sub.toJSON(),
      });

      if (rpcError) {
        throw rpcError;
      }

      setSubscription(sub);
      setIsSubscribed(true);
      setError(null);
      logger.info('Push subscription successful', sub);
      return true;
    } catch (err) {
      logger.error('Failed to subscribe the user', err);
      setError(err?.message || 'Subscription failed');
      return false;
    }
  };

  const unsubscribeFromPush = async () => {
    try {
      if (!('serviceWorker' in navigator && 'PushManager' in window)) {
        setError('Push not supported in this browser');
        return false;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (!sub) {
        setIsSubscribed(false);
        setSubscription(null);
        return true;
      }
      // Delete from server first (best-effort)
      const json = sub.toJSON?.();
      const endpoint = json?.endpoint || subscription?.endpoint;
      if (endpoint && hasSupabaseConfig && supabase) {
        try {
          await supabase.rpc('delete_push_subscription', { p_endpoint: endpoint });
  } catch (e) { /* server delete fail */ }
      }
      // Unsubscribe in browser
  try { await sub.unsubscribe(); } catch (e) { /* browser unsubscribe fail */ }
      setIsSubscribed(false);
      setSubscription(null);
      setError(null);
      return true;
    } catch (err) {
      logger.error('Failed to unsubscribe', err);
      setError(err?.message || 'Unsubscribe failed');
      return false;
    }
  };

  return { isSubscribed, subscribeToPush, unsubscribeFromPush, error };
}
