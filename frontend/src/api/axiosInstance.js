import axios from 'axios';
import { supabase } from '../lib/supabase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
    timeout: 30000,
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

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

// Response interceptor with proper token refresh handling
api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            return new Promise(async (resolve, reject) => {
                try {
                    // Try to refresh the session
                    const { data, error: refreshError } = await supabase.auth.refreshSession();

                    if (refreshError || !data?.session) {
                        // If refresh fails, logout
                        console.warn("Session expired, redirecting to login");
                        try {
                            await supabase.auth.signOut();
                        } catch (signOutErr) {
                            console.error('Logout during refresh failed', signOutErr);
                        }
                        window.location.href = '/login';
                        processQueue(null, null);
                        return reject(refreshError);
                    }

                    // Update authorization header
                    const { access_token } = data.session;
                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                    processQueue(null, access_token);
                    resolve(api(originalRequest));
                } catch (err) {
                    processQueue(err, null);
                    reject(err);
                } finally {
                    isRefreshing = false;
                }
            });
        }

        return Promise.reject(error);
    }
);

export default api;