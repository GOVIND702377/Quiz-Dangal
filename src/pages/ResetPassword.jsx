import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

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

    // 1) Best-effort detection from URL (works for both hash and query params)
    const qs = new URLSearchParams(search);
    const hashHasRecovery = hash.includes('type=recovery');
    const queryHasRecovery = qs.get('type') === 'recovery';
    const hasTokens = hash.includes('access_token=') || qs.has('code');
    if (hashHasRecovery || queryHasRecovery || hasTokens) setInRecovery(true);

    // 2) If the user arrives already signed-in on /reset-password (Supabase magic link), allow reset
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session && window.location.pathname.includes('/reset-password')) {
          setInRecovery(true);
        }
      } catch {}
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
      setMessage('Password updated! Please sign in again.');
      // For security: end any existing session that came from the recovery link
      try { await supabase.auth.signOut(); } catch {}
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setMessage(err?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-xl">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2 text-center">
          Reset Password
        </h1>
    {!inRecovery ? (
          <div className="text-center text-gray-600">
      The reset link is invalid or has expired, or you are already signed in. If you see this by mistake, open the link again or request a new reset from the Sign In screen.
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">New Password</label>
              <input type="password" className="w-full border rounded-lg px-3 py-2" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Enter new password" required />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" className="w-full border rounded-lg px-3 py-2" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Re-enter new password" required />
            </div>
            {message && <div className="text-sm text-center text-gray-700">{message}</div>}
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 font-semibold">
              {loading ? 'Updating…' : 'Update Password'}
            </button>
            <button type="button" onClick={() => navigate('/login')} className="w-full border rounded-lg py-2.5 font-medium bg-white hover:bg-gray-50">
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
