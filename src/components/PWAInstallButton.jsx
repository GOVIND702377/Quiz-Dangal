import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

const PWAInstallButton = () => {
  const DOWNLOAD_URL = (import.meta.env.VITE_DOWNLOAD_URL || '/quiz-dangal.apk').trim();
  const usingFallback = !import.meta.env.VITE_DOWNLOAD_URL && DOWNLOAD_URL.endsWith('/quiz-dangal.apk');
  const [show, setShow] = useState(false);
  const [hasApk, setHasApk] = useState(true);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator.standalone === true);
    // Always show on web (non-standalone), but only if we actually have an APK available
    setShow(!isStandalone);

    // Probe fallback path to avoid showing a broken button when no APK exists
    const probe = async () => {
      if (!usingFallback) {
        setHasApk(true);
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

    const onInstalled = () => setShow(false);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, [DOWNLOAD_URL, usingFallback]);

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
  setShow(true);
    } catch {
      // Fallback: open in a new tab (most browsers will present a download sheet)
      window.open(DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
  setShow(true);
    }
  };

  if (!show || !hasApk) return null;

  return (
    <button
      onClick={forceDownload}
      className="w-14 h-14 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center group relative overflow-hidden"
      style={{ position: 'fixed', bottom: '100px', right: '20px', zIndex: 9999 }}
      aria-label="Download App"
      title="Download App"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 opacity-30 animate-pulse"></div>
      <div className="absolute inset-0">
        <div className="absolute top-2 left-3 w-1 h-1 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0s', animationDuration: '1s'}}></div>
        <div className="absolute top-3 right-2 w-1 h-1 bg-orange-300 rounded-full animate-bounce" style={{animationDelay: '0.3s', animationDuration: '1.2s'}}></div>
        <div className="absolute bottom-3 left-2 w-1 h-1 bg-red-300 rounded-full animate-bounce" style={{animationDelay: '0.6s', animationDuration: '0.8s'}}></div>
      </div>
      <Download className="w-5 h-5 relative z-10" />
      <span className="hidden group-hover:block absolute right-16 bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap">Download App</span>
    </button>
  );
};

export default PWAInstallButton;