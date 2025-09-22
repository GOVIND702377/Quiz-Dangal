import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import App from '@/App';
import '@/index.css';
import { HelmetProvider } from 'react-helmet-async';
import { SoundProvider } from './contexts/SoundContext';

// Simple GA pageview for SPA (HashRouter)
function AnalyticsWrapper({ children }) {
  useEffect(() => {
    const send = () => {
      try {
        const page_path = window.location.pathname + window.location.search + window.location.hash;
        if (window.gtag) window.gtag('event', 'page_view', { page_path });
      } catch {}
    };
    // initial
    send();
    // hash changes (HashRouter)
    window.addEventListener('hashchange', send);
    return () => window.removeEventListener('hashchange', send);
  }, []);
  return children;
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  // eslint-disable-next-line no-console
  console.error('Root element #root not found in index.html');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AuthProvider>
      <HelmetProvider>
        <SoundProvider>
          <AnalyticsWrapper>
            <App />
          </AnalyticsWrapper>
        </SoundProvider>
      </HelmetProvider>
    </AuthProvider>
  </React.StrictMode>,
);