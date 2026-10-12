const express = require('express');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const Sale = require('../models/Sale');
const StockTransaction = require('../models/StockTransaction');
const LedgerEntry = require('../models/LedgerEntry');
const Campaign = require('../models/Campaign');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('workreports'));

const view = requirePermission('workreports.view', 'reports.view', 'settings.view');

function rangeFromQuery(req) {
  const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();
  const from = req.query.from
    ? new Date(`${req.query.from}T00:00:00.000Z`)
    : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from, to };
}

/**
 * Consolidated "work report": tasks, attendance, sales-by-staff and activity
 * rolled up for a date range so a manager can review the team in one screen.
 */
router.get('/', view, async (req, res, next) => {
  try {
    const { from, to } = rangeFromQuery(req);
    const fromYmd = from.toISOString().slice(0, 10);
    const toYmd = to.toISOString().slice(0, 10);

    const [taskStatus, taskAssignee, overdue, attendanceRows, salesByCashier, stockActivity, ledger, campaigns] =
      await Promise.all([
        Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Task.aggregate([
          { $group: { _id: '$assignedTo', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
          { $sort: { total: -1 } },
        ]),
        Task.countDocuments({ status: { $ne: 'done' }, dueDate: { $lt: new Date() } }),
        Attendance.find({ date: { $gte: fromYmd, $lte: toYmd } }).select('employeeName status'),
        Sale.aggregate([
          { $match: { createdAt: { $gte: from, $lte: to } } },
          { $group: { _id: '$cashierName', orders: { $sum: 1 }, total: { $sum: '$total' } } },
          { $sort: { total: -1 } },
        ]),
        StockTransaction.aggregate([
          { $match: { createdAt: { $gte: from, $lte: to } } },
          { $group: { _id: '$type', count: { $sum: 1 }, qty: { $sum: '$qty' } } },
        ]),
        LedgerEntry.aggregate([
          { $match: { date: { $gte: from, $lte: to } } },
          { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Campaign.find({ createdAt: { $gte: from, $lte: to } }).select('name channel status sent failed recipients'),
      ]);

    // Attendance rollup per employee.
    const att = {};
    for (const row of attendanceRows) {
      const key = row.employeeName || 'Unknown';
      if (!att[key]) att[key] = { employeeName: key, present: 0, absent: 0, leave: 0, halfDay: 0, total: 0 };
      if (row.status === 'present') att[key].present++;
      else if (row.status === 'absent') att[key].absent++;
      else if (row.status === 'leave') att[key].leave++;
      else if (row.status === 'half_day') att[key].halfDay++;
      att[key].total++;
    }

    const statusMap = { pending: 0, in_progress: 0, done: 0 };
    for (const t of taskStatus) statusMap[t._id] = t.count;

    const sales = salesByCashier.map((s) => ({ cashierName: s._id || 'Unknown', orders: s.orders, total: s.total }));
    const salesTotal = sales.reduce((sum, s) => sum + s.total, 0);
    const ordersTotal = sales.reduce((sum, s) => sum + s.orders, 0);

    res.json({
      success: true,
      data: {
        range: { from: fromYmd, to: toYmd },
        tasks: {
          byStatus: statusMap,
          total: (statusMap.pending || 0) + (statusMap.in_progress || 0) + (statusMap.done || 0),
          overdue,
          byAssignee: taskAssignee.map((a) => ({ assignedTo: a._id || 'Unassigned', total: a.total, done: a.done })),
        },
        attendance: {
          byEmployee: Object.values(att).sort((a, b) => b.total - a.total),
          present: attendanceRows.filter((r) => r.status === 'present').length,
          absent: attendanceRows.filter((r) => r.status === 'absent').length,
          leave: attendanceRows.filter((r) => r.status === 'leave').length,
          halfDay: attendanceRows.filter((r) => r.status === 'half_day').length,
        },
        sales: { byCashier: sales, total: salesTotal, orders: ordersTotal },
        activity: {
          stock: stockActivity.map((s) => ({ type: s._id || 'other', count: s.count, qty: s.qty })),
          ledger: ledger.map((l) => ({ type: l._id, total: l.total, count: l.count })),
          campaigns: campaigns.map((c) => ({ name: c.name, channel: c.channel, status: c.status, sent: c.sent, failed: c.failed, recipients: c.recipients })),
        },
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
