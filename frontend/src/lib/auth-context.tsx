'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { authApi, api } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  hasRole: (roleName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const t = localStorage.getItem('tto_token');
      const u = localStorage.getItem('tto_user');
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
        authApi.getProfile()
          .then(res => { setUser(res.data); localStorage.setItem('tto_user', JSON.stringify(res.data)); })
          .catch(() => {
            // Token geçersiz - sessizce temizle, yönlendirme yok
            setToken(null);
            setUser(null);
            localStorage.removeItem('tto_token');
            localStorage.removeItem('tto_user');
          });
      }
    } catch {}
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('tto_token', access_token);
    localStorage.setItem('tto_user', JSON.stringify(userData));
  };

  const register = async (data: any) => {
    const res = await api.post('/auth/register', data);
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('tto_token', access_token);
    localStorage.setItem('tto_user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('tto_token');
    localStorage.removeItem('tto_user');
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/')) {
      window.location.href = '/auth/login';
    }
  };

  const hasRole = (roleName: string) => user?.role?.name === roleName;

  return <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, hasRole }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
