import axios from 'axios';
import { auth } from '../lib/firebase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
});

// Attach Firebase token to every request
api.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;