const mongoose = require('mongoose');
const Setting = require('../models/Setting');
const Tenant = require('../models/Tenant');
const { runWithTenant } = require('../config/tenantContext');
const backupService = require('./backupService');

/**
 * Automatic ("real-time") backup scheduler.
 *
 * Every tenant can enable periodic snapshots from the Backup screen. Config is
 * stored in a Setting document with key 'backup' (tenant-scoped by the shared
 * plugin). The scheduler ticks on a fixed interval and takes a snapshot for any
 * tenant whose configured interval has elapsed, then prunes older snapshots.
 *
 * Design notes:
 *  - Runs entirely on the API server, so it also protects a single self-hosted
 *    install with no external cron.
 *  - Never throws to the top level; every failure is logged and retried next
 *    tick so a temporary DB/disk problem can't crash the process.
 */

const TICK_MS = Number(process.env.BACKUP_TICK_MS) || 5 * 60 * 1000; // check every 5 min
const DEFAULT_CONFIG = { enabled: false, intervalHours: 6, keep: 14, lastRunAt: null, lastFile: null };

let timer = null;
let running = false;

function normalizeConfig(raw = {}) {
  const intervalHours = Math.min(Math.max(Number(raw.intervalHours) || 6, 1), 168);
  const keep = Math.min(Math.max(Number(raw.keep) || 14, 1), 365);
  return {
    enabled: !!raw.enabled,
    intervalHours,
    keep,
    lastRunAt: raw.lastRunAt ? new Date(raw.lastRunAt).toISOString() : null,
    lastFile: raw.lastFile || null,
  };
}

/** Reads config for a tenant, returning defaults when unset. */
async function getConfig(tenantId) {
  if (!tenantId) return { ...DEFAULT_CONFIG };
  return runWithTenant({ tenantId }, async () => {
    const doc = await Setting.findOne({ key: 'backup' }).lean();
    return { ...DEFAULT_CONFIG, ...normalizeConfig(doc ? doc.autoBackup || {} : {}) };
  });
}

/** Persists config for a tenant. Returns the saved config. */
async function setConfig(tenantId, data = {}) {
  return runWithTenant({ tenantId }, async () => {
    let doc = await Setting.findOne({ key: 'backup' });
    const current = normalizeConfig(doc && doc.autoBackup ? (doc.autoBackup.toObject ? doc.autoBackup.toObject() : doc.autoBackup) : {});
    const next = { ...current };
    if (data.enabled !== undefined) next.enabled = !!data.enabled;
    if (data.intervalHours !== undefined) next.intervalHours = Math.min(Math.max(Number(data.intervalHours) || 6, 1), 168);
    if (data.keep !== undefined) next.keep = Math.min(Math.max(Number(data.keep) || 14, 1), 365);
    if (!doc) {
      doc = new Setting({ key: 'backup', businessName: 'backup' });
    }
    doc.set('autoBackup', next);
    await doc.save();
    return normalizeConfig(next);
  });
}

/** Takes a snapshot now and records the run in the config. */
async function runNow(tenantId, createdBy = 'auto') {
  const cfg = await getConfig(tenantId);
  const meta = await backupService.createBackupAsync(tenantId, createdBy, 'auto');
  backupService.pruneBackups(tenantId, cfg.keep);
  await runWithTenant({ tenantId }, async () => {
    const doc = await Setting.findOne({ key: 'backup' });
    if (doc) {
      doc.set('autoBackup', { ...cfg, lastRunAt: meta.createdAt, lastFile: meta.file });
      await doc.save();
    }
  });
  return meta;
}

async function listTenantIds() {
  // Cross-tenant read → must bypass the tenant plugin.
  return runWithTenant({ bypass: true }, async () => {
    const tenants = await Tenant.find().select('_id').lean();
    return tenants.map((t) => String(t._id));
  });
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const ids = await listTenantIds();
    const now = Date.now();
    for (const tenantId of ids) {
      try {
        const cfg = await getConfig(tenantId);
        if (!cfg.enabled) continue;
        const due = !cfg.lastRunAt || (now - new Date(cfg.lastRunAt).getTime()) >= cfg.intervalHours * 3600 * 1000;
        if (!due) continue;
        const meta = await runNow(tenantId, 'auto-scheduler');
        console.log(`[backup] auto snapshot for tenant ${tenantId}: ${meta.file} (${meta.documents} docs)`);
      } catch (e) {
        console.error(`[backup] auto snapshot failed for tenant ${tenantId}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[backup] scheduler tick failed:', e.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  if (mongoose.connection.readyState !== 1) {
    // Retry shortly after the DB connects.
    mongoose.connection.once('connected', () => start());
    return;
  }
  timer = setInterval(tick, TICK_MS);
  if (timer.unref) timer.unref();
  console.log(`[backup] auto-backup scheduler started (tick ${Math.round(TICK_MS / 1000)}s)`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, tick, getConfig, setConfig, runNow, normalizeConfig, DEFAULT_CONFIG };
