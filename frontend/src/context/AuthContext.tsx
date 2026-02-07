import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import type { User, RoleName, AuthResponse } from '../types';

interface AuthCtx {
  user: User | null; token: string | null; isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (r: RoleName) => boolean;
  hasMinRole: (r: RoleName) => boolean;
}

const hierarchy: Record<RoleName, number> = { admin: 4, operator: 3, service: 2, viewer: 1 };
const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get<User>('/auth/me').then(setUser).catch(() => { localStorage.removeItem('token'); setToken(null); }).finally(() => setIsLoading(false));
    } else { setIsLoading(false); }
  }, [token]);

  const login = async (email: string, password: string) => {
    const r = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem('token', r.token); setToken(r.token); setUser(r.user);
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('token'); setToken(null); setUser(null);
  };

  const hasRole = (r: RoleName) => user?.roles.includes(r) || false;
  const hasMinRole = (min: RoleName) => user?.roles.some(r => hierarchy[r] >= hierarchy[min]) || false;

  return <Ctx.Provider value={{ user, token, isLoading, login, logout, hasRole, hasMinRole }}>{children}</Ctx.Provider>;
}

export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('useAuth outside AuthProvider'); return c; };
