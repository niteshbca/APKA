const express = require('express');
const MasterRecord = require('../models/MasterRecord');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');
const { MASTER_TYPES, isValidMasterType } = require('../config/masterData');
const audit = require('../services/auditService');

const router = express.Router();

router.use(verifyToken);
router.use(requireModule('master'));

router.get('/types', requirePermission('master.view', 'settings.view'), (req, res) => {
  res.json({ success: true, data: MASTER_TYPES });
});

function typeGuard(req, res, next) {
  if (!isValidMasterType(req.params.type)) {
    return res.status(400).json({ success: false, message: `Unknown master type: ${req.params.type}` });
  }
  next();
}

router.get('/:type', typeGuard, requirePermission('master.view', 'settings.view'), async (req, res, next) => {
  try {
    const { search, active, page = 1, limit = 50, branch } = req.query;
    const query = { type: req.params.type };
    if (active !== undefined) query.active = active === 'true' || active === '1';
    if (branch) query.branch = branch;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await MasterRecord.countDocuments(query);
    const data = await MasterRecord.find(query)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ success: true, data, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

router.get('/:type/export', typeGuard, requirePermission('master.export', 'settings.view'), async (req, res, next) => {
  try {
    const data = await MasterRecord.find({ type: req.params.type }).sort({ name: 1 }).lean();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/:type/:id', typeGuard, requirePermission('master.view', 'settings.view'), async (req, res, next) => {
  try {
    const record = await MasterRecord.findOne({ _id: req.params.id, type: req.params.type });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.post('/:type', typeGuard, requirePermission('master.manage', 'settings.edit'), async (req, res, next) => {
  try {
    const { name, code, description, data, active, branch } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const dup = await MasterRecord.findOne({
      type: req.params.type,
      $or: [{ name }, ...(code ? [{ code: String(code).toUpperCase() }] : [])],
    });
    if (dup) return res.status(409).json({ success: false, message: 'A record with this name or code already exists' });
    const record = await MasterRecord.create({
      type: req.params.type,
      name,
      code: code ? String(code).toUpperCase() : '',
      description: description || '',
      data: data || {},
      active: active !== false,
      branch: branch || undefined,
      createdBy: req.userId,
    });
    audit.record(req, { action: 'master.create', entity: req.params.type, entityId: record._id, meta: { name: record.name } });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.put('/:type/:id', typeGuard, requirePermission('master.manage', 'settings.edit'), async (req, res, next) => {
  try {
    const record = await MasterRecord.findOne({ _id: req.params.id, type: req.params.type });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    if (req.body.name && req.body.name !== record.name) {
      const dup = await MasterRecord.findOne({ type: req.params.type, name: req.body.name, _id: { $ne: record._id } });
      if (dup) return res.status(409).json({ success: false, message: 'A record with this name already exists' });
      record.name = req.body.name;
    }
    if (req.body.code !== undefined) record.code = req.body.code ? String(req.body.code).toUpperCase() : '';
    if (req.body.description !== undefined) record.description = req.body.description;
    if (req.body.data !== undefined) record.data = req.body.data;
    if (req.body.active !== undefined) record.active = !!req.body.active;
    record.updatedBy = req.userId;
    await record.save();
    audit.record(req, { action: 'master.update', entity: req.params.type, entityId: record._id, meta: { name: record.name } });
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.delete('/:type/:id', typeGuard, requirePermission('master.manage', 'settings.edit'), async (req, res, next) => {
  try {
    const record = await MasterRecord.findOne({ _id: req.params.id, type: req.params.type });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    await MasterRecord.findByIdAndDelete(record._id);
    audit.record(req, { action: 'master.delete', entity: req.params.type, entityId: record._id, meta: { name: record.name } });
    res.json({ success: true, message: 'Record deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * Bulk import (JSON array). Skips duplicates instead of throwing so a large
 * file can be partially imported safely.
 */
router.post('/:type/import', typeGuard, requirePermission('master.import', 'settings.edit'), async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ success: false, message: 'rows[] is required' });
    let inserted = 0;
    let skipped = 0;
    for (const row of rows.slice(0, 5000)) {
      if (!row || !row.name) {
        skipped++;
        continue;
      }
      const exists = await MasterRecord.findOne({ type: req.params.type, name: row.name });
      if (exists) {
        skipped++;
        continue;
      }
      await MasterRecord.create({
        type: req.params.type,
        name: row.name,
        code: row.code ? String(row.code).toUpperCase() : '',
        description: row.description || '',
        data: row.data || {},
        active: row.active !== false,
        createdBy: req.userId,
      });
      inserted++;
    }
    audit.record(req, { action: 'master.import', entity: req.params.type, meta: { inserted, skipped } });
    res.json({ success: true, data: { inserted, skipped } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
