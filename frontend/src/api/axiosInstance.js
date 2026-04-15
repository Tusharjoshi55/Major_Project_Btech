import axios from 'axios';
import { supabase } from '../lib/supabase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
    timeout: 30000,
});

// Interceptor to inject the current Supabase session token
api.interceptors.request.use(async (config) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
        }
    } catch (err) {
        console.error("Supabase Token Error:", err);
    }
    return config;
});

// Global error handling for 401 (token expired/invalid)
api.interceptors.response.use(
    (res) => res,
    async (err) => {
        if (err.response?.status === 401) {
            console.warn("Unauthorized Session → Attempting logout");
            try {
                await supabase.auth.signOut();
            } catch (signOutErr) {
                console.error('Logout sync failed', signOutErr);
            }
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default api;