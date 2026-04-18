import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import supabase from '../lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // 2. Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const signup = async (email, password, displayName) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName }
            }
        });
        if (error) throw error;
        return data;
    };

    const loginWithGoogle = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
        return data;
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const resetPassword = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`
        });
        if (error) throw error;
    };

    // Enhanced getToken with automatic refresh handling
    const getToken = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                return session.access_token;
            }

            // Try to refresh session if no token available
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData?.session) {
                // If refresh fails, user needs to login again
                await supabase.auth.signOut();
                return null;
            }

            return refreshData.session.access_token;
        } catch (err) {
            console.error("Error getting token:", err);
            return null;
        }
    }, []);

    // Session refresh function for use in components
    const refreshSession = useCallback(async () => {
        try {
            const { data: { session }, error } = await supabase.auth.refreshSession();
            if (error) {
                await supabase.auth.signOut();
                return null;
            }
            return session;
        } catch (err) {
            console.error("Error refreshing session:", err);
            return null;
        }
    }, []);

    return (
        <AuthContext.Provider value={{
            user, loading,
            login, signup, loginWithGoogle, logout, resetPassword, getToken, refreshSession,
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
