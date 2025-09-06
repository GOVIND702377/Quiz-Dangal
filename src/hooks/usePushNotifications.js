import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

// IMPORTANT: Replace this with your own VAPID public key.
const VAPID_PUBLIC_KEY = 'BBzEo0FGas7iHo55RBT-n6RYxZX5HpwPSi3rDDx7BwVBF0EDCaw3bsEjip0XVfV6jL5sSxvsQNSz6bqhtXDidtA';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
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
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      setError('Push notifications are not supported by this browser.');
      return;
    }

    try {
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
      console.log('User is subscribed.', sub);
      return true;
    } catch (err) {
      console.error('Failed to subscribe the user: ', err);
      setError(err.message);
      return false;
    }
  };

  return { isSubscribed, subscribeToPush, error };
}
