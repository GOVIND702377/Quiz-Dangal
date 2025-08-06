// ========================================================================
// FILE: src/contexts/SupabaseAuthContext.jsx
// Is file ka poora purana code delete karke yeh naya code paste karen.
// ========================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Profile fetch karne ka function
    const refreshUserProfile = async (currentUser) => {
        if (currentUser) {
            try {
                const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
                // "no rows found" error ko ignore karenge, kyunki naye user ka profile turant nahi banta
                if (error && error.code !== 'PGRST116') throw error; 
                setUserProfile(data || null);
            } catch (error) {
                console.error("Error refreshing user profile:", error);
                setUserProfile(null);
            }
        }
    };

    useEffect(() => {
        setLoading(true);
        // Pehli baar session check karne ke liye
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            const currentUser = session?.user;
            setUser(currentUser ?? null);
            if (currentUser) {
                await refreshUserProfile(currentUser);
            }
            setLoading(false);
        });

        // Login ya logout hone par changes ko sunne ke liye
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = session?.user;
            setUser(currentUser ?? null);
            if (currentUser) {
                await refreshUserProfile(currentUser);
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    // Auto-create profile row for new users if not exists
    useEffect(() => {
        if (user && !loading) {
            supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()
                .then(({ data, error }) => {
                    if (!data) {
                        supabase.from('profiles').insert([
                            {
                                id: user.id,
                                email: user.email,
                                full_name: '',
                                phone_number: ''
                            }
                        ]).then(() => {
                            refreshUserProfile(user);
                        });
                    }
                });
        }
    }, [user, loading]);

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
