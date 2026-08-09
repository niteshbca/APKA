import { createContext, useContext, useState, useCallback } from 'react';
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

  const login = useCallback(async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem('pos_token', t);
    localStorage.setItem('pos_user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    return u;
  }, []);

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

  const isAdmin = !!user && ['admin', 'superadmin'].includes(user.role);
  const isSuperAdmin = !!user && user.role === 'superadmin';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAdmin, isSuperAdmin, ready: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
