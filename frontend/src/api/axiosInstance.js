import axios from 'axios';
import { auth } from '../lib/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
    timeout: 30000,
});

// 🔥 Create a promise to wait for auth initialization
let resolveAuth;
const authReady = new Promise((resolve) => {
    resolveAuth = resolve;
});

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    resolveAuth(user); // resolve once auth state is known
});

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
    try {
        // 🔥 WAIT until Firebase is initialized
        await authReady;

        if (currentUser) {
            const token = await currentUser.getIdToken(); // no force refresh needed
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (err) {
        console.error("Token error:", err);
    }

    return config;
});

// Global error handling
api.interceptors.response.use(
    (res) => res,
    async (err) => {
        if (err.response?.status === 401) {
            console.warn("Unauthorized → redirecting to login");
            try {
                const { signOut } = await import('firebase/auth');
                await signOut(auth);
            } catch (signOutErr) {
                console.error('Failed to sign out', signOutErr);
            }
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default api;