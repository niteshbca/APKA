import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { startSyncEngine, runSync, getSyncSnapshot, subscribe, resetFailedOps } from '../sync/engine';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [snapshot, setSnapshot] = useState({ status: 'OFFLINE', lastSyncAt: null, pendingOps: 0, lastError: null });

  useEffect(() => {
    const unsub = subscribe(setSnapshot);
    startSyncEngine();
    return unsub;
  }, []);

  const triggerSync = useCallback(async () => {
    await runSync(true);
    setSnapshot(getSyncSnapshot());
  }, []);

  const retryFailed = useCallback(async () => {
    await resetFailedOps();
    await runSync(true);
    setSnapshot(getSyncSnapshot());
  }, []);

  return (
    <SyncContext.Provider value={{ ...snapshot, triggerSync, retryFailed }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
