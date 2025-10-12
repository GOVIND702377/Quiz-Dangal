import React from 'react';
import ReactDOM from 'react-dom/client';
import { initWebVitals } from '@/lib/webVitals';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import App from '@/App';
import '@/index.css';
import { HelmetProvider } from 'react-helmet-async';
import { SoundProvider } from './contexts/SoundContext';
import { warmMotion } from '@/lib/motion-lite';

const rootEl = document.getElementById('root');
if (!rootEl) {
  // eslint-disable-next-line no-console
  console.error('Root element #root not found in index.html');
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AuthProvider>
        <HelmetProvider>
          <SoundProvider>
            <App />
          </SoundProvider>
        </HelmetProvider>
      </AuthProvider>
    </React.StrictMode>,
  );
}

// Defer vitals collection until after initial paint.
if (typeof window !== 'undefined') {
  requestIdleCallback ? requestIdleCallback(() => initWebVitals()) : setTimeout(() => initWebVitals(), 1500);
  warmMotion();
}