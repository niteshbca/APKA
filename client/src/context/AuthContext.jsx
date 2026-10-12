import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_user'));
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('pos_token'));

  const persist = useCallback((t, u) => {
    if (t) localStorage.setItem('pos_token', t);
    if (u) localStorage.setItem('pos_user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    return u;
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { token: t, user: u } = res.data;
    return persist(t, u);
  }, [persist]);

  const loginPin = useCallback(async (pin, branchId) => {
    const res = await api.post('/auth/login-pin', { pin, branchId });
    const { token: t, user: u } = res.data;
    return persist(t, u);
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((u) => {
    localStorage.setItem('pos_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      const u = res.data.user;
      localStorage.setItem('pos_user', JSON.stringify(u));
      setUser(u);
      return u;
    } catch {
      return null;
    }
  }, []);

  const permissions = useMemo(() => user?.permissions || [], [user]);

  const hasPermission = useCallback((perm) => {
    if (!user) return false;
    if (user.role === 'superadmin' || user.isPlatformAdmin) return true;
    if (!perm) return true;
    const perms = user.permissions || [];
    if (perms.includes('*')) return true;
    const list = Array.isArray(perm) ? perm : [perm];
    return list.some((p) => perms.includes(p));
  }, [user]);

  const isAdmin = !!user && ['admin', 'superadmin'].includes(user.role);
  const isSuperAdmin = !!user && user.role === 'superadmin';
  const isManager = !!user && ['admin', 'superadmin', 'manager'].includes(user.role);
  const isPlatformAdmin = !!user && (user.isPlatformAdmin || user.role === 'superadmin');

  const value = {
    user,
    token,
    tenant: user?.tenant || null,
    permissions,
    login,
    loginPin,
    logout,
    updateUser,
    refreshUser,
    hasPermission,
    isAdmin,
    isSuperAdmin,
    isManager,
    isPlatformAdmin,
    ready: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}