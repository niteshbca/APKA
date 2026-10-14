const express = require('express');
const Return = require('../models/Return');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');
const audit = require('../services/auditService');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('returns'));

const view = requirePermission('returns.view', 'sales.view', 'settings.view');
const manage = requirePermission('returns.manage', 'sales.return', 'settings.edit');

router.get('/', view, async (req, res, next) => {
  try {
    const { kind, status, search, page = 1, limit = 100 } = req.query;
    const query = {};
    if (kind && kind !== 'all') query.kind = kind;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerMobile: { $regex: search, $options: 'i' } },
        { invoiceNo: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await Return.countDocuments(query);
    const data = await Return.find(query).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total });
  } catch (err) { next(err); }
});

router.get('/summary', view, async (req, res, next) => {
  try {
    const rows = await Return.aggregate([
      { $match: Return.tenantFilter() },
      { $group: { _id: '$kind', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const byKind = { return: 0, udhaar: 0, payment: 0 };
    const count = { return: 0, udhaar: 0, payment: 0 };
    for (const r of rows) {
      if (byKind[r._id] !== undefined) {
        byKind[r._id] = r.total || 0;
        count[r._id] = r.count || 0;
      }
    }
    const openCount = await Return.countDocuments({ status: 'open' });
    const outstanding = Math.max(0, byKind.udhaar - byKind.payment);
    res.json({
      success: true,
      data: {
        returnsAmount: byKind.return,
        returnsCount: count.return,
        udhaarGiven: byKind.udhaar,
        udhaarCount: count.udhaar,
        recovered: byKind.payment,
        outstanding,
        openCount,
      },
    });
  } catch (err) { next(err); }
});

router.post('/', manage, async (req, res, next) => {
  try {
    if (req.body.amount === undefined || req.body.amount === '') {
      return res.status(400).json({ success: false, message: 'Amount is required' });
    }
    const entry = await Return.create({ ...req.body, createdBy: req.userId });
    audit.record(req, { action: 'returns.create', entity: 'return', entityId: entry._id, meta: { kind: entry.kind, amount: entry.amount } });
    res.status(201).json({ success: true, data: entry });
  } catch (err) { next(err); }
});

router.put('/:id', manage, async (req, res, next) => {
  try {
    const entry = await Return.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    audit.record(req, { action: 'returns.update', entity: 'return', entityId: entry._id, meta: { kind: entry.kind } });
    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
});

router.delete('/:id', manage, async (req, res, next) => {
  try {
    const entry = await Return.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    audit.record(req, { action: 'returns.delete', entity: 'return', entityId: entry._id });
    res.json({ success: true, message: 'Entry deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
