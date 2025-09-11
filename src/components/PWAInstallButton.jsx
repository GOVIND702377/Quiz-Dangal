import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

const PWAInstallButton = () => {
  const DOWNLOAD_URL = (import.meta.env.VITE_DOWNLOAD_URL || '/quiz-dangal.apk').trim();
  const usingFallback = !import.meta.env.VITE_DOWNLOAD_URL && DOWNLOAD_URL.endsWith('/quiz-dangal.apk');
  const isDev = import.meta.env.DEV;
  // Start hidden when using fallback path to avoid initial flash before probe
  const [hasApk, setHasApk] = useState(!usingFallback);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const mm = window.matchMedia('(display-mode: standalone)');
    const standalone = mm.matches || (window.navigator.standalone === true);
    setIsStandalone(standalone);
    const onModeChange = (e) => setIsStandalone(e.matches || (window.navigator.standalone === true));
    try {
      mm.addEventListener('change', onModeChange);
    } catch {
      // Safari iOS older versions use addListener/removeListener
      if (mm.addListener) mm.addListener(onModeChange);
    }

    // Probe fallback path to avoid showing a broken button when no APK exists
    const probe = async () => {
      if (!usingFallback) {
        setHasApk(true);
        return;
      }
      // In local dev, skip probing fallback path to avoid noisy 404s from Vite server.
      if (isDev) {
        setHasApk(false);
        return;
      }
      try {
        const resp = await fetch(DOWNLOAD_URL, { method: 'HEAD' });
        setHasApk(resp.ok);
      } catch {
        setHasApk(false);
      }
    };
    probe();

    const onBeforeInstall = (e) => {
      // Use custom prompt
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
      try {
        mm.removeEventListener('change', onModeChange);
      } catch {
        if (mm.removeListener) mm.removeListener(onModeChange);
      }
    };
  }, [DOWNLOAD_URL, usingFallback, isDev]);

  const forceDownload = async () => {
    try {
      const resp = await fetch(DOWNLOAD_URL, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('Network response was not ok');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = DOWNLOAD_URL.split('/').pop() || 'quiz-dangal-download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in a new tab (most browsers will present a download sheet)
      window.open(DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleInstall = async () => {
    try {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setCanInstall(false);
      }
    } catch {
      // Ignore install errors
    }
  };

  // Hide only when running as an installed PWA. Always show on the web regardless of APK/install availability.
  if (isStandalone) return null;

  const handleClick = async () => {
    if (hasApk) {
      await forceDownload();
      return;
    }
    if (canInstall && deferredPrompt) {
      await handleInstall();
      return;
    }
    // Graceful fallback: guide the user to install via browser menu when prompt isn't available
    try {
      alert('To install the app, use your browser menu and choose "Add to Home screen".');
    } catch {
      // no-op
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-14 h-14 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center group relative overflow-hidden"
      style={{ position: 'fixed', bottom: '100px', right: '20px', zIndex: 9999 }}
      aria-label={hasApk ? 'Download App' : (canInstall ? 'Install App' : 'Get App')}
      title={hasApk ? 'Download App' : (canInstall ? 'Install App' : 'Get App')}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 opacity-30 animate-pulse"></div>
      <div className="absolute inset-0">
        <div className="absolute top-2 left-3 w-1 h-1 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0s', animationDuration: '1s'}}></div>
        <div className="absolute top-3 right-2 w-1 h-1 bg-orange-300 rounded-full animate-bounce" style={{animationDelay: '0.3s', animationDuration: '1.2s'}}></div>
        <div className="absolute bottom-3 left-2 w-1 h-1 bg-red-300 rounded-full animate-bounce" style={{animationDelay: '0.6s', animationDuration: '0.8s'}}></div>
      </div>
  <Download className="w-5 h-5 relative z-10" />
  <span className="hidden group-hover:block absolute right-16 bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap">{hasApk ? 'Download App' : (canInstall ? 'Install App' : 'Get App')}</span>
    </button>
  );
};

export default PWAInstallButton;