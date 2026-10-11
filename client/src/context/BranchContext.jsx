import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const BranchContext = createContext(null);

export function BranchProvider({ children }) {
  const { user, isSuperAdmin } = useAuth();
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranchState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_active_branch'));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const loadBranches = useCallback(async () => {
    try {
      const res = await api.get('/branches');
      const list = res.data.data || [];
      setBranches(list);
      return list;
    } catch {
      setBranches([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadBranches().then((list) => {
      if (list.length === 0) return;
      const saved = activeBranch;
      if (isSuperAdmin) {
        if (!saved || !list.find((b) => b._id === saved._id)) {
          const main = list.find((b) => b.isMain) || list[0];
          setActiveBranch(main);
        }
      } else {
        const mine = user.branch;
        const mineId = typeof mine === 'object' ? mine?._id : mine;
        const found = list.find((b) => b._id === mineId) || list[0];
        setActiveBranch(found);
      }
    });
  }, [user, isSuperAdmin]);

  const setActiveBranch = useCallback((branch) => {
    if (!branch) {
      localStorage.removeItem('pos_active_branch');
      setActiveBranchState(null);
      return;
    }
    localStorage.setItem('pos_active_branch', JSON.stringify(branch));
    setActiveBranchState(branch);
  }, []);

  const refresh = useCallback(() => loadBranches(), [loadBranches]);

  const canSwitchBranch = isSuperAdmin;

  return (
    <BranchContext.Provider
      value={{ branches, activeBranch, setActiveBranch, loading, refresh, canSwitchBranch }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}