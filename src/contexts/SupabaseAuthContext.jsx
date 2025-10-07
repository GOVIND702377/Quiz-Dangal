// ========================================================================
// FILE: src/contexts/SupabaseAuthContext.jsx
// Is file ka poora purana code delete karke yeh naya code paste karen.
// ========================================================================

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, hasSupabaseConfig } from '@/lib/customSupabaseClient';

const AuthContext = createContext();

// Inner provider with all hooks so outer wrapper can early-return without tripping hooks rule
function AuthProviderInner({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
    const initProfileRef = useRef(false);

    // Profile fetch karne ka function
    const refreshUserProfile = async (currentUser) => {
        if (currentUser) {
            try {
                const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
                // "no rows found" (PGRST116) error ko ignore karenge, kyunki naye user ka profile turant nahi banta.
                // Lekin, agar multiple rows milti hain (jo ek data integrity issue hai), to error throw karna zaroori hai.
                if (error) {
                    // Sirf "0 rows" wala error ignore karein.
                    const isNoRowsError = error.code === 'PGRST116' && error.details?.includes('0 rows');
                    if (!isNoRowsError) throw error;
                }
                setUserProfile(data || null);
            } catch (error) {
                setUserProfile(null);
            }
        }
    };

    useEffect(() => {
        // Detect recovery intent in URL once, so routing can allow reset page even if a session appears
        try {
            const u = new URL(window.location.href);
            const isRec = (u.hash || '').includes('type=recovery') || new URLSearchParams(u.search).get('type') === 'recovery';
            if (isRec) setIsRecoveryFlow(true);
    } catch (e) { /* recovery URL parse fail */ }
        setLoading(true);
        // Pehli baar session check karne ke liye
    supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user;
            setUser(currentUser ?? null);
            setLoading(false);
            if (currentUser) {
                refreshUserProfile(currentUser);
            } else {
                setUserProfile(null);
            }
        }).catch(() => {
            // Network/offline errors shouldn't force logout; keep prior session state
            setLoading(false);
        });

        // Login ya logout hone par changes ko sunne ke liye
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const currentUser = session?.user;
            setUser(currentUser ?? null);
            setLoading(false);
            if (currentUser) {
                refreshUserProfile(currentUser);
            } else {
                setUserProfile(null);
            }
            if (event === 'PASSWORD_RECOVERY') {
                setIsRecoveryFlow(true);
            }
            // If Supabase reports the user signed out (often after a failed refresh), clear state
            if (event === 'SIGNED_OUT') {
                setUser(null);
                setUserProfile(null);
                setIsRecoveryFlow(false); // clear recovery mode after logout
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    // Safety net: periodic session validation to recover from invalid/expired refresh tokens
    useEffect(() => {
        if (!user) return;

        const id = setInterval(async () => {
            if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
                return; // offline mode: defer session checks
            }

            try {
                const { data, error } = await supabase.auth.getSession();
                if (error) {
                    return; // transient error; allow Supabase to recover via refresh token
                }

                if (!data?.session) {
                    const { data: refreshed } = await supabase.auth.refreshSession();
                    if (refreshed?.session) {
                        return;
                    }
                    setUser(null);
                    setUserProfile(null);
                }
            } catch (err) {
                // swallow transient network issues; Supabase SDK will retry automatically
            }
        }, 5 * 60 * 1000); // every 5 minutes

        return () => clearInterval(id);
    }, [user]);

    // Auto-create/upsert profile row for new users if not exists + referral attribution (via secure RPC)
    useEffect(() => {
        if (!user || loading) return;

        // Guard double execution in React 18 StrictMode in dev
        if (initProfileRef.current) return;
        initProfileRef.current = true;

        const params = new URLSearchParams(window.location.search);
        const refParam = params.get('ref');

        // Only include safe defaults so we don't overwrite user's existing data on refresh
        const payload = {
            id: user.id,
            full_name: user.user_metadata?.full_name || ''
            // NOTE: Do NOT set mobile_number (or other fields) here.
            // Upsert runs on every fresh login; providing an empty string would overwrite
            // the user's saved number. We'll let the profile modal manage it explicitly.
        };

        supabase
            .from('profiles')
            .upsert([payload], { onConflict: 'id' })
            .then(async () => {
                // Process referral once via SECURITY DEFINER function to avoid RLS trigger issues
                const refFlag = `qd_referral_processed_${user.id}`;
                const alreadyProcessed = (() => { try { return sessionStorage.getItem(refFlag) === '1'; } catch { return false; } })();
                if (!alreadyProcessed && refParam && refParam !== user.id) {
                    try {
                        await supabase.rpc('handle_referral_bonus', {
                            referred_user_uuid: user.id,
                            referrer_code: refParam,
                        });
                        try { sessionStorage.setItem(refFlag, '1'); } catch (e3) { /* sessionStorage blocked */ }
                    } catch {
                        // ignore referral errors so profile init continues
                    }
                }
            })
            .catch(() => {
                // Ignore upsert errors here; UI can still function and retries will happen on next auth state change
            })
            .finally(() => {
                // Refresh local profile state so navbar and UI update immediately
                refreshUserProfile(user);
            });
    }, [user, loading, userProfile]);

    // Ensure referral_code exists for sharing
    useEffect(() => {
        if (userProfile && !userProfile.referral_code && user) {
            const code = (user.id || '').replace(/-/g, '').slice(0, 8);
            supabase
                .from('profiles')
                .update({ referral_code: code })
                .eq('id', user.id)
                .then(() => {
                    refreshUserProfile(user);
                })
                .catch(() => {
                    // ignore
                });
        }
    }, [userProfile, user]);

    // SIGN UP FUNCTION (EMAIL)
    const signUp = async (email, password) => {
        return await supabase.auth.signUp({ email, password });
    };

    // SIGN IN FUNCTION (EMAIL)
    const signIn = async (email, password) => {
        return await supabase.auth.signInWithPassword({ email, password });
    };

    const hardSignOut = async () => {
    try { await supabase.auth.signOut(); } catch (e2) { /* periodic signOut fail */ }
        try {
            // Clear common Supabase/local keys to avoid ghost sessions
            Object.keys(localStorage).forEach((k) => {
                if (k.startsWith('sb-') || k.startsWith('qd_') || k.toLowerCase().includes('supabase')) {
                    localStorage.removeItem(k);
                }
            });
            sessionStorage.clear();
    } catch (e3) { /* localStorage cleanup fail */ }
        setUser(null);
        setUserProfile(null);
        // Redirect to login explicitly
        try { window.location.assign('/login'); } catch { window.location.href = '/login'; }
    };

    const value = {
        supabase,
        user,
        userProfile,
        loading,
        isRecoveryFlow,
        hasSupabaseConfig: true,
        signUp,
        signIn,
        signOut: hardSignOut,
        refreshUserProfile,
    };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const AuthProvider = ({ children }) => {
    const _bypass = String(import.meta.env.VITE_BYPASS_AUTH || '').toLowerCase();
    const devBypass = _bypass === '1' || _bypass === 'true' || _bypass === 'yes';
    if (devBypass) {
        const mockUser = {
            id: 'dev-bypass-admin',
            email: 'dev-admin@example.com',
            app_metadata: { provider: 'dev-bypass' },
        };
        const mockProfile = {
            id: mockUser.id,
            full_name: 'Dev Admin',
            role: 'admin',
            wallet_balance: 0,
            current_streak: 0,
            referral_code: 'DEVADMIN',
        };
        const value = {
            supabase: null,
            user: mockUser,
            userProfile: mockProfile,
            loading: false,
            isRecoveryFlow: false,
            hasSupabaseConfig: false,
            signUp: async () => { throw new Error('Auth disabled in dev bypass'); },
            signIn: async () => { throw new Error('Auth disabled in dev bypass'); },
            signOut: async () => {},
            refreshUserProfile: () => {},
        };
        return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
    }
    if (!hasSupabaseConfig) {
        const value = {
            supabase: null,
            user: null,
            userProfile: null,
            loading: false,
            isRecoveryFlow: false,
            hasSupabaseConfig: false,
            signUp: async () => { throw new Error('Supabase config missing'); },
            signIn: async () => { throw new Error('Supabase config missing'); },
            signOut: async () => {},
            refreshUserProfile: () => {},
        };
        return (
            <AuthContext.Provider value={value}>
                <div className="min-h-screen flex items-center justify-center p-6">
                    <div className="bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-lg w-full shadow-xl text-center">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">Configuration Missing</h2>
                        <p className="text-gray-700 mb-2">Create a <code>.env</code> file in the project root with:</p>
                        <pre className="text-left text-sm bg-gray-100 p-3 rounded-md overflow-auto"><code>VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key</code></pre>
                        <p className="text-gray-600 mt-3">Or for local UI only testing set <code>VITE_BYPASS_AUTH=1</code> then restart dev server.</p>
                    </div>
                </div>
            </AuthContext.Provider>
        );
    }
    return <AuthProviderInner>{children}</AuthProviderInner>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
