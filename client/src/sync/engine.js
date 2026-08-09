import api from '../api/axios';
import db from '../db';
import {
  getRetryableOps,
  markOpDone,
  markOpFailed,
  getLastSyncAt,
  setLastSyncAt,
  countPendingOps,
  applyPull,
  resetFailedOps,
} from '../db/offlineService';
import { getDeviceId } from '../utils/license';
import { saveValidationState } from '../utils/license';

export const SYNC_STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  SYNCING: 'SYNCING',
  SYNC_COMPLETED: 'SYNC COMPLETED',
  SYNC_FAILED: 'SYNC FAILED',
};

const PULL_INTERVAL = 2 * 60 * 1000;
const PUSH_BATCH_SIZE = 50;

let listeners = [];
let running = false;

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

let status = navigator.onLine ? SYNC_STATUS.ONLINE : SYNC_STATUS.OFFLINE;
let lastSyncAt = null;
let pendingOps = 0;
let lastError = null;

function emit() {
  const snapshot = { status, lastSyncAt, pendingOps, lastError };
  listeners.forEach((fn) => fn(snapshot));
}

function setStatus(s) {
  status = s;
  emit();
}

async function ping() {
  try {
    const res = await api.get('/health', { timeout: 6000 });
    // "Online" means the API AND the online database are reachable. If the API
    // is up but MongoDB isn't (e.g. desktop app in an office with no internet),
    // we must fall back to local IndexedDB mode.
    return res.data?.status === 'ok' && res.data?.db !== false;
  } catch {
    return false;
  }
}

async function updatePendingCount() {
  pendingOps = await countPendingOps();
  emit();
}

/**
 * Push the local outbox to the server, then pull master data.
 * Idempotent: server upserts by clientSaleId/clientOpId so re-pushing
 * never creates duplicate invoices.
 */
export async function runSync(manual = false) {
  if (running) return { skipped: true };
  running = true;
  setStatus(SYNC_STATUS.SYNCING);

  try {
    const online = await ping();
    if (!online) {
      setStatus(SYNC_STATUS.OFFLINE);
      return { ok: false, reason: 'offline' };
    }

    const deviceId = await getDeviceId();

    // --- PUSH ---
    // Include previously-failed ops so a temporary error doesn't leave
    // "N pending sync" stuck forever even while online. Sorted by createdAt so
    // dependencies (e.g. a product created offline) are pushed before the sale
    // that references them.
    const ops = await getRetryableOps();
    const pushable = ops.slice(0, PUSH_BATCH_SIZE);
    if (pushable.length > 0) {
      try {
        const res = await api.post('/sync/push', { deviceId, operations: pushable.map((o) => ({ clientOpId: o.clientOpId, opType: o.opType, payload: o.payload })) });
        const results = res.data?.data?.results || [];
        for (const r of results) {
          if (r.status === 'created' || r.status === 'done' || r.status === 'duplicate') {
            await markOpDone(r.clientOpId, r);
            // Update the local invoice number to the real server number.
            if (r.invoiceNo) {
              const op = await db.get('outbox', r.clientOpId);
              const payload = op?.payload || {};
              const oldNo = payload.invoiceNo;
              if (oldNo) {
                const sale = await db.get('sales', payload.clientSaleId);
                if (sale) await db.put('sales', { ...sale, invoiceNo: r.invoiceNo, serverInvoiceNo: r.invoiceNo, synced: true });
                const inv = await db.get('invoices', oldNo);
                if (inv) {
                  await db.delete('invoices', oldNo);
                  await db.put('invoices', { ...inv, invoiceNo: r.invoiceNo, clientSaleId: payload.clientSaleId });
                }
              }
            }
          } else {
            await markOpFailed(r.clientOpId, r.message || 'sync error');
          }
        }
        await updatePendingCount();
      } catch (err) {
        if (err.status === 403 && err.code === 'LICENSE_EXPIRED') {
          setStatus(SYNC_STATUS.SYNC_FAILED);
          lastError = 'License expired - server rejected operations';
          emit();
          return { ok: false, reason: 'license_expired' };
        }
        throw err;
      }
    }

    // --- PULL ---
    const since = await getLastSyncAt();
    const pullRes = await api.get('/sync/pull', { params: { deviceId, since: since || undefined } });
    const data = pullRes.data?.data;
    if (data) {
      await applyPull(data);
      if (data.serverTime) await setLastSyncAt(data.serverTime);
      lastSyncAt = data.serverTime || new Date().toISOString();
      await saveValidationState({ valid: true, serverTime: data.serverTime });
    }

    // Heartbeat device registration.
    try {
      await api.post('/sync/device', { deviceId, name: navigator.userAgent.includes('Win') ? 'Windows PC' : 'POS Device', platform: navigator.userAgent });
    } catch {
      /* non fatal */
    }

    setStatus(SYNC_STATUS.SYNC_COMPLETED);
    emit();
    return { ok: true, pushed: pushable.length };
  } catch (err) {
    setStatus(SYNC_STATUS.SYNC_FAILED);
    lastError = err.message;
    emit();
    return { ok: false, error: err.message };
  } finally {
    running = false;
  }
}

export function getSyncSnapshot() {
  return { status, lastSyncAt, pendingOps, lastError };
}

export async function startSyncEngine() {
  const apply = (online) => {
    if (online) {
      setStatus(SYNC_STATUS.ONLINE);
      setTimeout(() => runSync(), 1500);
    } else {
      setStatus(SYNC_STATUS.OFFLINE);
    }
  };

  window.addEventListener('online', () => apply(true));
  window.addEventListener('offline', () => apply(false));

  await updatePendingCount();

  const online = navigator.onLine && (await ping());
  if (online) {
    setStatus(SYNC_STATUS.ONLINE);
    setTimeout(() => runSync(), 2000);
  } else {
    setStatus(SYNC_STATUS.OFFLINE);
  }

  setInterval(async () => {
    const isOnline = navigator.onLine && (await ping());
    if (isOnline && status === SYNC_STATUS.OFFLINE) {
      setStatus(SYNC_STATUS.ONLINE);
    }
    if (isOnline) runSync();
  }, PULL_INTERVAL);

  return getSyncSnapshot();
}

export { resetFailedOps };
