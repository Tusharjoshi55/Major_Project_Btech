import axios from 'axios';
import { auth } from '../lib/firebase.js';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
    timeout: 30000,
});

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Global error handling
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            // Token expired — redirect to login
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default api;
