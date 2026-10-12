const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');
const { getTenantId } = require('../config/tenantContext');
const audit = require('../services/auditService');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('backup'));

const view = requirePermission('backup.view', 'backup.manage', 'settings.view');
const manage = requirePermission('backup.manage', 'settings.edit');

// JSON snapshots are written here; the folder is git-ignored.
const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const FILE_RE = /^bak_[0-9a-f]{24}_\d{14}\.json$/;

// Tenant-scoped business collections included in a snapshot.
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

router.get('/', view, async (req, res, next) => {
  try {
    ensureDir();
    const tenantId = getTenantId();
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => FILE_RE.test(f));
    const list = [];
    for (const f of files) {
      if (tenantId && !f.startsWith(`bak_${tenantId}_`)) continue;
      const stat = fs.statSync(backupPath(f));
      list.push({ file: f, size: stat.size, modifiedAt: stat.mtime.toISOString(), meta: readMeta(f) });
    }
    list.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    res.json({ success: true, data: list, total: list.length });
  } catch (err) { next(err); }
});

router.post('/', manage, async (req, res, next) => {
  try {
    const tenantId = getTenantId();
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'No company context selected for this backup.' });
    }
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
      createdBy: req.userDoc ? req.userDoc.name : '',
      collections: Object.keys(data).length,
      documents,
    };
    // Line 1 = meta (JSON), remainder = type-preserving EJSON payload.
    fs.writeFileSync(backupPath(file), `${JSON.stringify(meta)}\n${EJSON.stringify(data)}`);
    audit.record(req, { action: 'backup.manage', entity: 'backup', entityId: file, meta: { documents } });
    res.status(201).json({ success: true, data: meta });
  } catch (err) { next(err); }
});

router.get('/:file/download', view, async (req, res, next) => {
  try {
    const name = safeName(req.params.file);
    if (!name) return res.status(400).json({ success: false, message: 'Invalid backup file name' });
    if (!fs.existsSync(backupPath(name))) return res.status(404).json({ success: false, message: 'Backup not found' });
    res.download(backupPath(name), name);
  } catch (err) { next(err); }
});

router.post('/:file/restore', manage, async (req, res, next) => {
  try {
    const name = safeName(req.params.file);
    if (!name) return res.status(400).json({ success: false, message: 'Invalid backup file name' });
    if (!fs.existsSync(backupPath(name))) return res.status(404).json({ success: false, message: 'Backup not found' });

    const meta = readMeta(name);
    const tenantId = getTenantId();
    if (tenantId && meta && meta.tenantId && meta.tenantId !== tenantId) {
      return res.status(400).json({ success: false, message: 'This backup belongs to a different company.' });
    }

    const raw = fs.readFileSync(backupPath(name), 'utf8');
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
    audit.record(req, { action: 'backup.restore', entity: 'backup', entityId: name, meta: { restored } });
    res.json({ success: true, data: { restored } });
  } catch (err) { next(err); }
});

router.delete('/:file', manage, async (req, res, next) => {
  try {
    const name = safeName(req.params.file);
    if (!name) return res.status(400).json({ success: false, message: 'Invalid backup file name' });
    const full = backupPath(name);
    if (!fs.existsSync(full)) return res.status(404).json({ success: false, message: 'Backup not found' });
    fs.unlinkSync(full);
    audit.record(req, { action: 'backup.delete', entity: 'backup', entityId: name });
    res.json({ success: true, message: 'Backup deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
