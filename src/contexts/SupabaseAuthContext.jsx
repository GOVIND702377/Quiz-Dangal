// ========================================================================
// FILE: src/contexts/SupabaseAuthContext.jsx
// Is file ka poora purana code delete karke yeh naya code paste karen.
// ========================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, hasSupabaseConfig } from '@/lib/customSupabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Dev bypass: allow running app without Supabase for local UI testing
    const _bypass = String(import.meta.env.VITE_BYPASS_AUTH || '').toLowerCase();
    const devBypass = _bypass === '1' || _bypass === 'true' || _bypass === 'yes';

    if (devBypass) {
        const value = {
            supabase: null,
            user: null,
            userProfile: null,
            loading: false,
            signUp: async () => { throw new Error('Auth disabled in dev bypass'); },
            signIn: async () => { throw new Error('Auth disabled in dev bypass'); },
            signOut: async () => {},
            refreshUserProfile: () => {},
        };
        return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
    }

        // If Supabase config is missing, show a friendly message and skip auth wiring
        if (!hasSupabaseConfig) {
                return (
                        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100">
                            <div className="bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-lg w-full shadow-xl text-center">
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">Configuration Missing</h2>
                                <p className="text-gray-700 mb-2">Please create a <code>.env</code> file in the project root with:</p>
                                <pre className="text-left text-sm bg-gray-100 p-3 rounded-md overflow-auto"><code>VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key</code></pre>
                                <p className="text-gray-600 mt-3">Then restart the dev server.</p>
                            </div>
                        </div>
                );
        }

    // Profile fetch karne ka function
    const refreshUserProfile = async (currentUser) => {
        if (currentUser) {
            try {
                const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
                // "no rows found" error ko ignore karenge, kyunki naye user ka profile turant nahi banta
                if (error && error.code !== 'PGRST116') throw error; 
                setUserProfile(data || null);
            } catch (error) {
                setUserProfile(null);
            }
        }
    };

    useEffect(() => {
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
        });

        // Login ya logout hone par changes ko sunne ke liye
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user;
            setUser(currentUser ?? null);
            setLoading(false);
            if (currentUser) {
                refreshUserProfile(currentUser);
            } else {
                setUserProfile(null);
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    // Auto-create/upsert profile row for new users if not exists + referral attribution
    useEffect(() => {
        if (!user || loading) return;

        const params = new URLSearchParams(window.location.search);
        const refParam = params.get('ref');

        const payload = {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || '',
            phone_number: ''
        };

        // First time insert: include referred_by if present and not self
        if (!userProfile && refParam && refParam !== user.id) {
            payload.referred_by = refParam;
        }

        supabase
            .from('profiles')
            .upsert([payload], { onConflict: 'id' })
            .then(async () => {
                // Existing profile without referral: set it once (no-op if already set)
                if (userProfile && !userProfile.referred_by && refParam && refParam !== user.id) {
                    await supabase
                        .from('profiles')
                        .update({ referred_by: refParam })
                        .eq('id', user.id);
                }
            })
            .catch(() => {
                // Ignore upsert/update errors here; UI can still function and retries will happen on next auth state change
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

    const value = {
        supabase,
        user,
        userProfile,
        loading,
        signUp,
        signIn,
        signOut: () => supabase.auth.signOut(),
        refreshUserProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
