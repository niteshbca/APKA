const express = require('express');
const Supplier = require('../models/Supplier');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { genClientId } = require('../utils/id');
const audit = require('../services/auditService');

const router = express.Router();

router.use(verifyToken);

function branchScope(req, query = {}) {
  if (req.userRole !== 'superadmin' && !req.isPlatformAdmin && req.userBranch) query.branch = req.userBranch;
  return query;
}

router.get('/', requirePermission('purchases.view', 'settings.view'), async (req, res, next) => {
  try {
    const { search, active, page = 1, limit = 50 } = req.query;
    const query = branchScope(req, {});
    if (active !== undefined) query.active = active === 'true' || active === '1';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await Supplier.countDocuments(query);
    const data = await Supplier.find(query).sort({ name: 1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requirePermission('purchases.view', 'settings.view'), async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermission('purchases.create', 'settings.edit'), async (req, res, next) => {
  try {
    const { name, code, phone, email, gstin, address, creditLimit, openingBalance, branch } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Supplier name is required' });
    const supplier = await Supplier.create({
      clientId: genClientId('sup'),
      name,
      code: code ? String(code).toUpperCase() : '',
      phone: phone || '',
      email: email || '',
      gstin: gstin || '',
      address: address || '',
      creditLimit: creditLimit || 0,
      openingBalance: openingBalance || 0,
      branch: (req.userRole !== 'superadmin' && !req.isPlatformAdmin && req.userBranch) ? req.userBranch : (branch || undefined),
    });
    audit.record(req, { action: 'supplier.create', entity: 'Supplier', entityId: supplier._id, meta: { name: supplier.name } });
    res.status(201).json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requirePermission('purchases.edit', 'settings.edit'), async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    for (const f of ['name', 'phone', 'email', 'gstin', 'address', 'creditLimit', 'openingBalance', 'active']) {
      if (req.body[f] !== undefined) supplier[f] = req.body[f];
    }
    if (req.body.code !== undefined) supplier.code = req.body.code ? String(req.body.code).toUpperCase() : '';
    await supplier.save();
    audit.record(req, { action: 'supplier.update', entity: 'Supplier', entityId: supplier._id });
    res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requirePermission('purchases.delete', 'settings.edit'), async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    await Supplier.findByIdAndDelete(supplier._id);
    audit.record(req, { action: 'supplier.delete', entity: 'Supplier', entityId: supplier._id });
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
