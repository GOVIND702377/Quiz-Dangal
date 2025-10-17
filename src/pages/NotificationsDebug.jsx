import React from 'react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function NotificationsDebug() {
  const { isSubscribed, subscribeToPush, unsubscribeFromPush, error } = usePushNotifications();
  const [status, setStatus] = React.useState({
    permission: 'unknown',
    swReady: false,
    swScope: '',
    endpoint: '',
    hasVapid: false,
  });

  React.useEffect(() => {
    (async () => {
      try {
        const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
        let swReady = false; let swScope = ''; let endpoint = '';
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            swReady = !!reg; swScope = reg?.scope || '';
            const sub = await reg.pushManager.getSubscription();
            endpoint = sub?.endpoint ? String(sub.endpoint) : '';
          } catch (e) {
            // eslint-disable-next-line no-console
            console.debug('SW readiness/subscription check failed:', e);
          }
        }
        const env = (typeof window !== 'undefined' && window.__QUIZ_DANGAL_ENV__) ? window.__QUIZ_DANGAL_ENV__ : {};
        const vapid = String((import.meta?.env?.VITE_VAPID_PUBLIC_KEY) || env.VITE_VAPID_PUBLIC_KEY || env.VAPID_PUBLIC_KEY || '').trim();
        setStatus({ permission: perm, swReady, swScope, endpoint, hasVapid: vapid.length > 0 });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.debug('Notification diagnostics failed:', e);
      }
    })();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-xl bg-white text-gray-900 rounded-2xl shadow-sm">
      <h1 className="text-xl font-semibold mb-2">Notifications Diagnostics</h1>
      <p className="text-sm text-gray-600 mb-4">Yahan aap push setup ka quick status dekh sakte hain.</p>

      <div className="space-y-2 text-sm">
        <div><strong>Permission:</strong> {status.permission}</div>
        <div><strong>Service Worker Ready:</strong> {status.swReady ? 'Yes' : 'No'}</div>
        <div><strong>SW Scope:</strong> <span className="break-all">{status.swScope || '—'}</span></div>
        <div><strong>Subscribed:</strong> {isSubscribed ? 'Yes' : 'No'}</div>
        <div><strong>Endpoint:</strong> <span className="break-all">{status.endpoint || '—'}</span></div>
        <div><strong>VAPID Public Key present:</strong> {status.hasVapid ? 'Yes' : 'No'}</div>
        {error && <div className="text-red-600">Error: {error}</div>}
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={subscribeToPush}>Subscribe</Button>
        <Button variant="outline" onClick={unsubscribeFromPush}>Unsubscribe</Button>
      </div>

      <div className="text-xs text-gray-500 mt-4">
        Dev tip: Agar local pe SW register nahi ho raha, URL me ?sw=1 add karke page ek baar open karein.
      </div>
    </div>
  );
}
