const express = require('express');
const Task = require('../models/Task');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');
const audit = require('../services/auditService');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('tasks'));

const view = requirePermission('tasks.view', 'settings.view');
const manage = requirePermission('tasks.manage', 'settings.edit');

router.get('/', view, async (req, res, next) => {
  try {
    const { status, priority, assignedTo, search, page = 1, limit = 100 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = { $regex: assignedTo, $options: 'i' };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { assignedTo: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await Task.countDocuments(query);
    const data = await Task.find(query).sort({ status: 1, dueDate: 1, createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total });
  } catch (err) { next(err); }
});

router.post('/', manage, async (req, res, next) => {
  try {
    if (!req.body.title) return res.status(400).json({ success: false, message: 'Task title is required' });
    const task = await Task.create({ ...req.body, createdBy: req.userId });
    audit.record(req, { action: 'tasks.create', entity: 'task', entityId: task._id, meta: { title: task.title } });
    res.status(201).json({ success: true, data: task });
  } catch (err) { next(err); }
});

router.put('/:id', manage, async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    audit.record(req, { action: 'tasks.update', entity: 'task', entityId: task._id, meta: { status: task.status } });
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
});

router.delete('/:id', manage, async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    audit.record(req, { action: 'tasks.delete', entity: 'task', entityId: task._id });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) { next(err); }
});

router.get('/summary', view, async (req, res, next) => {
  try {
    const [pending, inProgress, done, overdue] = await Promise.all([
      Task.countDocuments({ status: 'pending' }),
      Task.countDocuments({ status: 'in_progress' }),
      Task.countDocuments({ status: 'done' }),
      Task.countDocuments({ status: { $ne: 'done' }, dueDate: { $lt: new Date() } }),
    ]);
    res.json({ success: true, data: { pending, inProgress, done, overdue, total: pending + inProgress + done } });
  } catch (err) { next(err); }
});

module.exports = router;
