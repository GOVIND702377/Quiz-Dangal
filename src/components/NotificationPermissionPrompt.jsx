import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Shows a minimal one-button prompt 10s after login if Notification.permission === 'default'
// Once user takes a decision (allow/deny), we set a localStorage flag to never show again on this device.
const NotificationPermissionPrompt = () => {
  const { user } = useAuth();
  const { subscribeToPush } = usePushNotifications();
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  const storageKey = useMemo(() => {
    const uid = user?.id || 'guest';
    return `qd_notifChoice_${uid}`;
  }, [user]);

  // If browser already has a decision, record it so we never attempt again on this device
  useEffect(() => {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
        localStorage.setItem(storageKey, 'true');
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    // Only schedule when: user is logged in, notifications supported, permission is default, and we haven't recorded a decision for this device.
    try {
      const supported = (typeof window !== 'undefined' && 'Notification' in window);
      const alreadyDecided = (() => { try { return localStorage.getItem(storageKey) === 'true'; } catch { return false; } })();
      if (!user || !supported) return;
      if (Notification.permission !== 'default') return; // granted or denied -> never show
      if (alreadyDecided) return;

      // Show after 10 seconds from login/mount
      timerRef.current = setTimeout(() => setOpen(true), 10000);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    } catch {
      // ignore envs without Notification
    }
  }, [user, storageKey]);

  const handleAllow = async () => {
    try {
      // Trigger native prompt (via subscribeToPush which asks permission first, then subscribes)
      await subscribeToPush();
    } catch { /* ignore */ }
    // After click, if a decision is made, persist flag and close
    try {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
        localStorage.setItem(storageKey, 'true');
      }
    } catch {}
    setOpen(false);
  };

  const handleDismiss = () => {
    // Ignore case: do not set flag; this ensures it can appear again on next login if still default
    setOpen(false);
  };

  // Render minimal dialog only when open
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="bg-slate-900/95 border border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Stay updated with quiz reminders</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-slate-300">
          Allow notifications to get reminders before quizzes start and when results are out.
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {/* No secondary action per requirement; close via overlay/X counts as ignore */}
          <Button onClick={handleAllow} className="font-semibold">Allow</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationPermissionPrompt;
