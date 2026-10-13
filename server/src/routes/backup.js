const express = require('express');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');
const { getTenantId } = require('../config/tenantContext');
const audit = require('../services/auditService');
const backupService = require('../services/backupService');
const backupScheduler = require('../services/backupScheduler');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('backup'));

const view = requirePermission('backup.view', 'backup.manage', 'settings.view');
const manage = requirePermission('backup.manage', 'settings.edit');

router.get('/', view, async (req, res, next) => {
  try {
    const tenantId = getTenantId();
    const list = backupService.listBackups(tenantId);
    res.json({ success: true, data: list, total: list.length });
  } catch (err) { next(err); }
});

router.post('/', manage, async (req, res, next) => {
  try {
    const tenantId = getTenantId();
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'No company context selected for this backup.' });
    }
    const meta = await backupService.createBackupAsync(tenantId, req.userDoc ? req.userDoc.name : '', 'manual');
    audit.record(req, { action: 'backup.manage', entity: 'backup', entityId: meta.file, meta: { documents: meta.documents } });
    res.status(201).json({ success: true, data: meta });
  } catch (err) { next(err); }
});

/** Automatic backup configuration + status for the current company. */
router.get('/auto', view, async (req, res, next) => {
  try {
    const cfg = await backupScheduler.getConfig(getTenantId());
    res.json({ success: true, data: cfg });
  } catch (err) { next(err); }
});

router.put('/auto', manage, async (req, res, next) => {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return res.status(400).json({ success: false, message: 'No company context.' });
    const cfg = await backupScheduler.setConfig(tenantId, req.body || {});
    audit.record(req, { action: 'backup.autoconfig', entity: 'backup', meta: cfg });
    res.json({ success: true, data: cfg });
  } catch (err) { next(err); }
});

router.post('/auto/run-now', manage, async (req, res, next) => {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return res.status(400).json({ success: false, message: 'No company context.' });
    const meta = await backupScheduler.runNow(tenantId, req.userDoc ? req.userDoc.name : '');
    res.status(201).json({ success: true, data: meta });
  } catch (err) { next(err); }
});

router.get('/:file/download', view, async (req, res, next) => {
  try {
    const name = backupService.safeName(req.params.file);
    if (!name) return res.status(400).json({ success: false, message: 'Invalid backup file name' });
    const full = backupService.backupPath(name);
    if (!require('fs').existsSync(full)) return res.status(404).json({ success: false, message: 'Backup not found' });
    res.download(full, name);
  } catch (err) { next(err); }
});

router.post('/:file/restore', manage, async (req, res, next) => {
  try {
    const name = backupService.safeName(req.params.file);
    if (!name) return res.status(400).json({ success: false, message: 'Invalid backup file name' });
    const { restored } = await backupService.restoreBackup(name, getTenantId());
    audit.record(req, { action: 'backup.restore', entity: 'backup', entityId: name, meta: { restored } });
    res.json({ success: true, data: { restored } });
  } catch (err) {
    if (/not found|Invalid|different company/i.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.delete('/:file', manage, async (req, res, next) => {
  try {
    const name = backupService.safeName(req.params.file);
    if (!name) return res.status(400).json({ success: false, message: 'Invalid backup file name' });
    backupService.deleteBackup(name);
    audit.record(req, { action: 'backup.delete', entity: 'backup', entityId: name });
    res.json({ success: true, message: 'Backup deleted' });
  } catch (err) {
    if (/not found|Invalid/i.test(err.message)) return res.status(404).json({ success: false, message: err.message });
    next(err);
  }
});

module.exports = router;
