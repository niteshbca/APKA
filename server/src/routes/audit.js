const express = require('express');
const AuditLog = require('../models/AuditLog');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('audit'));

const view = requirePermission('audit.view', 'settings.view');

router.get('/', view, async (req, res, next) => {
  try {
    const { action, entity, user, outcome, from, to, search, page = 1, limit = 100 } = req.query;
    const query = {};
    if (action) query.action = { $regex: action, $options: 'i' };
    if (entity) query.entity = entity;
    if (outcome) query.outcome = outcome;
    if (user) query.user = user;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) query.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    if (search) {
      query.$or = [
        { action: { $regex: search, $options: 'i' } },
        { entity: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { entityId: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await AuditLog.countDocuments(query);
    const data = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    res.json({ success: true, data, total });
  } catch (err) { next(err); }
});

router.get('/summary', view, async (req, res, next) => {
  try {
    const [byAction, byOutcome, total] = await Promise.all([
      AuditLog.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }]),
      AuditLog.aggregate([{ $group: { _id: '$outcome', count: { $sum: 1 } } }]),
      AuditLog.countDocuments({}),
    ]);
    const outcomes = { success: 0, failure: 0 };
    for (const o of byOutcome) outcomes[o._id || 'success'] = o.count;
    res.json({
      success: true,
      data: {
        total,
        success: outcomes.success,
        failure: outcomes.failure,
        byAction: byAction.map((a) => ({ action: a._id, count: a.count })),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
