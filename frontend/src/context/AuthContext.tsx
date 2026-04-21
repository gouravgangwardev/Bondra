// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { authAPI } from '../services/api';

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string | null;
  isGuest?: boolean;
  bio?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string }) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}


export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Init: restore auth from storage ──────────────────────────────────────
  useEffect(() => {
    const initAuth = () => {
      try {
        const token = localStorage.getItem('accessToken');
        const userJson = localStorage.getItem('user');

        if (token && userJson) {
          try {
            const parsedUser: User = JSON.parse(userJson);
            if (!parsedUser?.id) throw new Error('Invalid user');
            setAccessToken(token);
            setUser(parsedUser);
          } catch (e) {
            console.error('Corrupt user data:', e);
            localStorage.clear();
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        localStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await authAPI.login(credentials);
      const { user: u, accessToken: token, refreshToken } = res;

      if (!u || !token) throw new Error('Invalid login response');

      localStorage.setItem('accessToken', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(u));

      setUser(u);
      setAccessToken(token);
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const register = async (data: { username: string; email: string; password: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await authAPI.register(data);
      const { user: u, accessToken: token, refreshToken } = res;

      if (!u || !token) throw new Error('Invalid register response');

      localStorage.setItem('accessToken', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(u));

      setUser(u);
      setAccessToken(token);
    } catch (err: any) {
      const msg = err?.message || 'Registration failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // ── Guest Login ────────────────────────────────────────────────────────────
  const loginAsGuest = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await authAPI.loginAsGuest();
      const { user: u, accessToken: token, refreshToken } = res;

      if (!u || !token) throw new Error('Invalid guest response');

      localStorage.setItem('accessToken', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(u));

      setUser(u);
      setAccessToken(token);
    } catch (err: any) {
      const msg = err?.message || 'Guest login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = () => {
    // Best-effort server logout — don't block on it
    authAPI.logout().catch(() => {});

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    setUser(null);
    setAccessToken(null);
    setError(null);
  };

  // ── Update User ────────────────────────────────────────────────────────────
  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    accessToken,
    isLoading,
    isAuthenticated: !!user && !!accessToken,
    error,
    login,
    register,
    loginAsGuest,
    logout,
    updateUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
