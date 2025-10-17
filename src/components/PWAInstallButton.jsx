import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

const PWAInstallButton = () => {
  // Website-only mode: no APK download. We only support PWA install when the browser provides a prompt.
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mm = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
    const isStandaloneView = () => {
      try {
        return Boolean(mm?.matches || window.navigator?.standalone === true);
      } catch {
        return false;
      }
    };

    setIsStandalone(isStandaloneView());

    const onModeChange = (event) => {
      setIsStandalone(Boolean(event?.matches) || (window.navigator?.standalone === true));
    };

    if (mm) {
      try {
        mm.addEventListener('change', onModeChange);
      } catch {
        if (mm.addListener) mm.addListener(onModeChange);
      }
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      if (mm) {
        try {
          mm.removeEventListener('change', onModeChange);
        } catch {
          if (mm.removeListener) mm.removeListener(onModeChange);
        }
      }
    };
  }, []);

  // Website-only: remove any download capability.

  const handleInstall = async () => {
    try {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      // After user acts (accepted or dismissed), clear the prompt reference.
      setDeferredPrompt(null);
      setCanInstall(false);
    } catch {
      // Ignore install errors
    }
  };

  // One-tap install only: we render the button only when the native prompt is available
  const handleClick = async () => {
    if (canInstall && deferredPrompt) {
      await handleInstall();
    }
  };

  // Hide if already installed OR install prompt not available yet
  if (isStandalone || !canInstall || !deferredPrompt) return null;

  return (
    <button
      onClick={handleClick}
      className="w-14 h-14 rounded-full btn-fire transition-all duration-300 transform hover:scale-105 flex items-center justify-center group relative overflow-hidden"
      style={{ position: 'fixed', bottom: '100px', right: '20px', zIndex: 9999 }}
      aria-label={'Install App'}
      title={'Install App'}
    >
      {/* decorative small flame at top for vibe */}
      <svg className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 opacity-70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M12 2c1.5 2 2 3.5 2 5 0 1.5-.5 3-2 4-1.5-1-2-2.5-2-4 0-1.5.5-3 2-5Z" fill="url(#flameGrad)" />
        <defs>
          <linearGradient id="flameGrad" x1="12" y1="2" x2="12" y2="11" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fde047"/>
            <stop offset="1" stopColor="#f97316"/>
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0" />
      <Download className="w-5 h-5 relative z-10 drop-shadow" />
      <span className="hidden group-hover:block absolute right-16 bg-gray-900/90 backdrop-blur text-white px-2 py-1 rounded text-xs whitespace-nowrap border border-white/10 shadow">
        Install App
      </span>
    </button>
  );
};

export default PWAInstallButton;