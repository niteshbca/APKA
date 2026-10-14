const express = require('express');
const LedgerEntry = require('../models/LedgerEntry');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');
const audit = require('../services/auditService');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('accounts'));

const view = requirePermission('accounts.view', 'settings.view');
const manage = requirePermission('accounts.manage', 'settings.edit');
const report = requirePermission('accounts.report', 'settings.view');

router.get('/entries', view, async (req, res, next) => {
  try {
    const { type, category, from, to, search, page = 1, limit = 100 } = req.query;
    const query = {};
    if (type) query.type = type;
    if (category) query.category = category;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    if (search) {
      query.$or = [
        { party: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { note: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await LedgerEntry.countDocuments(query);
    const data = await LedgerEntry.find(query).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total });
  } catch (err) { next(err); }
});

router.post('/entries', manage, async (req, res, next) => {
  try {
    const { type, amount } = req.body;
    if (!['income', 'expense'].includes(type)) return res.status(400).json({ success: false, message: 'type must be income or expense' });
    if (amount === undefined || Number(amount) < 0) return res.status(400).json({ success: false, message: 'A valid amount is required' });
    const entry = await LedgerEntry.create({ ...req.body, createdBy: req.userId });
    audit.record(req, { action: 'accounts.entry.create', entity: 'ledger', entityId: entry._id, meta: { type, amount } });
    res.status(201).json({ success: true, data: entry });
  } catch (err) { next(err); }
});

router.put('/entries/:id', manage, async (req, res, next) => {
  try {
    const entry = await LedgerEntry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    audit.record(req, { action: 'accounts.entry.update', entity: 'ledger', entityId: entry._id });
    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
});

router.delete('/entries/:id', manage, async (req, res, next) => {
  try {
    const entry = await LedgerEntry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    audit.record(req, { action: 'accounts.entry.delete', entity: 'ledger', entityId: entry._id });
    res.json({ success: true, message: 'Entry deleted' });
  } catch (err) { next(err); }
});

router.get('/summary', report, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    let start;
    let end;
    let label;
    if (from && to) {
      start = new Date(`${from}T00:00:00.000Z`);
      end = new Date(`${to}T23:59:59.999Z`);
      label = `${from} → ${to}`;
    } else {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      start = new Date(`${month}-01T00:00:00.000Z`);
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end = new Date(end.getTime() - 1);
      label = month;
    }

    const [rows, allIncome, allExpense] = await Promise.all([
      LedgerEntry.find(LedgerEntry.tenantFilter({ date: { $gte: start, $lte: end } })),
      LedgerEntry.aggregate([{ $match: LedgerEntry.tenantFilter({ type: 'income' }) }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      LedgerEntry.aggregate([{ $match: LedgerEntry.tenantFilter({ type: 'expense' }) }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);

    const income = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const expense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    const byCategory = {};
    for (const r of rows) {
      const key = `${r.type}:${r.category || 'Uncategorised'}`;
      byCategory[key] = (byCategory[key] || 0) + r.amount;
    }
    res.json({
      success: true,
      data: {
        month: label,
        from: from || undefined,
        to: to || undefined,
        income,
        expense,
        net: income - expense,
        allTimeIncome: allIncome[0]?.total || 0,
        allTimeExpense: allExpense[0]?.total || 0,
        byCategory: Object.entries(byCategory).map(([k, v]) => {
          const [type, category] = k.split(':');
          return { type, category, amount: v };
        }).sort((a, b) => b.amount - a.amount),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
