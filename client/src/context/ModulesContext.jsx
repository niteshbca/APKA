import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

/**
 * Loads the tenant's effective module set from the backend and exposes a
 * synchronous `isEnabled(key)` helper used to build the sidebar and gate
 * routes. The backend remains the source of truth (requireModule), so if the
 * config cannot be loaded we fail OPEN and let the server enforce access.
 */
const ModulesContext = createContext(null);

const FALLBACK = {
  enabled: null,
  registry: [],
  isEnabled: () => true,
  reload: () => {},
};

export function ModulesProvider({ children }) {
  const { token, user } = useAuth();
  const [enabled, setEnabled] = useState(null);
  const [registry, setRegistry] = useState([]);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/modules');
      setRegistry(res.data.data.registry || []);
      setEnabled(res.data.data.enabled || []);
    } catch {
      setEnabled(null);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload, user?.tenant]);

  const isEnabled = useCallback(
    (key) => {
      if (!key) return true;
      if (!enabled) return true; // not loaded / offline -> fail open; server enforces
      if (!enabled.length) return true; // empty means "all enabled"
      return enabled.includes(key);
    },
    [enabled]
  );

  const value = useMemo(
    () => ({ enabled, registry, isEnabled, reload, setEnabled }),
    [enabled, registry, isEnabled, reload]
  );

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules() {
  return useContext(ModulesContext) || FALLBACK;
}
