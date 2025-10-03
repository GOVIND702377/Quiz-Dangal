import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import App from '@/App';
import '@/index.css';
import { HelmetProvider } from 'react-helmet-async';
import { SoundProvider } from './contexts/SoundContext';

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
          <App />
        </SoundProvider>
      </HelmetProvider>
    </AuthProvider>
  </React.StrictMode>,
);