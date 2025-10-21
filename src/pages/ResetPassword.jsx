import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet-async';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [inRecovery, setInRecovery] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = url.hash || '';
    const search = url.search || '';

    // Helper: extract code from either query (?code=) or hash query (#/path?code=)
    const extractCode = () => {
      const qs = new URLSearchParams(search);
      const codeFromQuery = qs.get('code');
      if (codeFromQuery) return codeFromQuery;
      const idx = hash.indexOf('?');
      if (idx !== -1) {
        const hs = new URLSearchParams(hash.substring(idx + 1));
        return hs.get('code');
      }
      return null;
    };

    // 1) Best-effort detection from URL (works for both hash tokens and PKCE code)
    const qs = new URLSearchParams(search);
    const hashHasRecovery = hash.includes('type=recovery');
    const queryHasRecovery = qs.get('type') === 'recovery';
    const hasTokens = hash.includes('access_token=') || !!extractCode();
    if (hashHasRecovery || queryHasRecovery || hasTokens) setInRecovery(true);

    // 1b) If PKCE code is present, exchange it for a session before updateUser
    (async () => {
      const code = extractCode();
      if (!code) return;
      try {
  const { error } = await supabase.auth.exchangeCodeForSession({ code });
  if (error) throw error;
        // Clean code from URL to avoid re-exchange on refresh
        try {
          const cleanUrl = window.location.origin + window.location.pathname + (window.location.hash.split('?')[0] || '');
          window.history.replaceState({}, document.title, cleanUrl);
  } catch (e) { /* token check fail */ }
        setInRecovery(true);
      } catch (e) {
        // Show a friendly message but keep the form visible in case hash tokens exist
        setMessage(e?.message || 'Could not validate reset link. Try requesting a new one.');
      }
    })();

    // 2) If the user arrives already signed-in on /reset-password (Supabase magic link), allow reset
    (async () => {
      try {
  const { data: sessData } = await supabase.auth.getSession();
  if (sessData?.session && window.location.pathname.includes('/reset-password')) {
          setInRecovery(true);
        }
  } catch (e) { /* password update fail */ }
    })();

    // 3) React to auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setInRecovery(true);
      // If SDK logs user in due to magic link, keep them on this page until password is updated
      if (event === 'SIGNED_IN') {
        setInRecovery(true);
      }
    });
    return () => subscription?.unsubscribe();
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    if (pw1.length < 6) return setMessage('Password must be at least 6 characters.');
    if (pw1 !== pw2) return setMessage('Passwords do not match.');
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
  setMessage('Password updated! Redirecting to sign in…');
  // For security: end any existing session that came from the recovery link
  try { await supabase.auth.signOut(); } catch (e) { /* signOut after reset fail */ }
  // Redirect with success flag; replace to prevent navigating back to reset page
  navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setMessage(err?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="min-h-screen flex items-center justify-center p-4">
      <Helmet>
        <title>Reset Password – Quiz Dangal</title>
        <meta name="robots" content="noindex, nofollow" />
  <link rel="canonical" href="https://quizdangal.com/reset-password/" />
      </Helmet>
      <div className="bg-gradient-to-br from-indigo-900/50 via-violet-900/40 to-fuchsia-900/40 backdrop-blur-xl border border-indigo-700/60 rounded-2xl p-8 max-w-md w-full shadow-xl text-slate-100">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-indigo-300 to-fuchsia-400 bg-clip-text text-transparent mb-2 text-center">
          Reset Password
        </h1>
    {!inRecovery ? (
          <div className="text-center text-slate-300">
      The reset link is invalid or has expired, or you are already signed in. If you see this by mistake, open the link again or request a new reset from the Sign In screen.
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-200 mb-1">New Password</label>
              <input type="password" className="w-full border border-slate-300 bg-white text-black rounded-lg px-3 py-2" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Enter new password" required />
            </div>
            <div>
              <label className="block text-sm text-slate-200 mb-1">Confirm New Password</label>
              <input type="password" className="w-full border border-slate-300 bg-white text-black rounded-lg px-3 py-2" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Re-enter new password" required />
            </div>
            {message && <div className="text-sm text-center text-slate-300">{message}</div>}
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-700 text-white rounded-lg py-2.5 font-semibold">
              {loading ? 'Updating…' : 'Update Password'}
            </button>
              <button type="button" onClick={() => navigate('/login')} className="w-full bg-white text-black border border-slate-300 hover:bg-slate-50 rounded-lg shadow-md focus:ring-2 focus:ring-indigo-500/40 py-2.5 font-medium">
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
