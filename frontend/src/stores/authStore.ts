import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    fullName: string;
    role: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    setAuth: (user: User, token: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            setAuth: (user, token) => {
                // M7 Fix: Only store token in localStorage for API interceptor
                // User data is managed by Zustand persist ('auth-storage' key)
                localStorage.setItem('token', token);
                set({ user, token });
            },
            logout: () => {
                localStorage.removeItem('token');
                set({ user: null, token: null });
            },
        }),
        {
            name: 'auth-storage',
        }
    )
);
