import { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const login = (email, password) =>
        signInWithEmailAndPassword(auth, email, password);

    const signup = async (email, password, displayName) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
            await updateProfile(cred.user, { displayName });
        }
        return cred;
    };

    const loginWithGoogle = () =>
        signInWithPopup(auth, new GoogleAuthProvider());

    const logout = () => signOut(auth);

    const resetPassword = (email) =>
        sendPasswordResetEmail(auth, email);

    const getToken = () => user?.getIdToken();

    return (
        <AuthContext.Provider value={{
            user, loading,
            login, signup, loginWithGoogle, logout, resetPassword, getToken,
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
