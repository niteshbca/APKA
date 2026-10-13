const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

/**
 * Backup engine shared by the manual "Backup & Restore" screen and the
 * automatic background scheduler. A backup is a JSON snapshot of all
 * tenant-scoped business collections: line 1 is meta, the rest is a
 * type-preserving EJSON payload.
 */

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const FILE_RE = /^bak_[0-9a-f]{24}_\d{14}\.json$/;

const COLLECTIONS = [
  'branches',
  'users',
  'categories',
  'products',
  'customers',
  'sales',
  'invoices',
  'purchases',
  'stocktransactions',
  'settings',
  'counters',
  'suppliers',
  'employees',
  'salaryrecords',
  'attendances',
  'ledgerentries',
  'tasks',
  'campaigns',
  'labeltemplates',
  'labelprintlogs',
  'auditlogs',
  'tombstones',
];

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function safeName(name) {
  return FILE_RE.test(name) ? name : null;
}

function backupPath(name) {
  return path.join(BACKUP_DIR, name);
}

function readMeta(name) {
  try {
    const fd = fs.openSync(backupPath(name), 'r');
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    const first = buf.slice(0, n).toString('utf8').split('\n')[0];
    return JSON.parse(first);
  } catch {
    return null;
  }
}

/** Lists backups for a tenant (newest first). */
function listBackups(tenantId) {
  ensureDir();
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => FILE_RE.test(f));
  const list = [];
  for (const f of files) {
    if (tenantId && !f.startsWith(`bak_${tenantId}_`)) continue;
    const stat = fs.statSync(backupPath(f));
    list.push({ file: f, size: stat.size, modifiedAt: stat.mtime.toISOString(), meta: readMeta(f) });
  }
  list.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return list;
}

/**
 * Creates a snapshot for one tenant. Returns the meta object.
 * `source` is recorded in the meta ('manual' | 'auto').
 */
async function createBackupAsync(tenantId, createdBy = '', source = 'manual') {
  if (!tenantId) throw new Error('No company context selected for this backup.');
  ensureDir();
  const db = mongoose.connection.db;
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const data = {};
  let documents = 0;
  for (const name of COLLECTIONS) {
    try {
      const rows = await db.collection(name).find({ tenant: tenantObjectId }).toArray();
      data[name] = rows;
      documents += rows.length;
    } catch {
      data[name] = [];
    }
  }
  const createdAt = new Date();
  const stamp = createdAt.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const file = `bak_${tenantId}_${stamp}.json`;
  const meta = {
    app: 'NiteshPro POS',
    version: 1,
    tenantId,
    file,
    createdAt: createdAt.toISOString(),
    createdBy,
    source,
    collections: Object.keys(data).length,
    documents,
  };
  fs.writeFileSync(backupPath(file), `${JSON.stringify(meta)}\n${EJSON.stringify(data)}`);
  return meta;
}

/** Restores a snapshot, replacing the tenant's backed-up collections. */
async function restoreBackup(name, tenantId) {
  const safe = safeName(name);
  if (!safe) throw new Error('Invalid backup file name');
  if (!fs.existsSync(backupPath(safe))) throw new Error('Backup not found');

  const meta = readMeta(safe);
  if (tenantId && meta && meta.tenantId && meta.tenantId !== tenantId) {
    throw new Error('This backup belongs to a different company.');
  }

  const raw = fs.readFileSync(backupPath(safe), 'utf8');
  const payload = EJSON.parse(raw.slice(raw.indexOf('\n') + 1));
  const db = mongoose.connection.db;
  const tenantObjectId = tenantId ? new mongoose.Types.ObjectId(tenantId) : null;
  let restored = 0;
  for (const [coll, rows] of Object.entries(payload)) {
    if (tenantObjectId) await db.collection(coll).deleteMany({ tenant: tenantObjectId });
    else await db.collection(coll).deleteMany({});
    if (Array.isArray(rows) && rows.length) {
      await db.collection(coll).insertMany(rows);
      restored += rows.length;
    }
  }
  return { restored, meta };
}

/** Removes a backup file. */
function deleteBackup(name) {
  const safe = safeName(name);
  if (!safe) throw new Error('Invalid backup file name');
  const full = backupPath(safe);
  if (!fs.existsSync(full)) throw new Error('Backup not found');
  fs.unlinkSync(full);
}

/** Keeps only the newest `keep` snapshots for a tenant. Returns #removed. */
function pruneBackups(tenantId, keep = 10) {
  if (!tenantId || !keep || keep < 1) return 0;
  const list = listBackups(tenantId);
  let removed = 0;
  for (const item of list.slice(keep)) {
    try {
      fs.unlinkSync(backupPath(item.file));
      removed += 1;
    } catch {
      /* ignore */
    }
  }
  return removed;
}

module.exports = {
  BACKUP_DIR,
  FILE_RE,
  COLLECTIONS,
  ensureDir,
  safeName,
  backupPath,
  readMeta,
  listBackups,
  createBackupAsync,
  restoreBackup,
  deleteBackup,
  pruneBackups,
};
