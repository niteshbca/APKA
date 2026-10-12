const express = require('express');
const Employee = require('../models/Employee');
const SalaryRecord = require('../models/SalaryRecord');
const Attendance = require('../models/Attendance');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');
const audit = require('../services/auditService');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('hr'));

const view = requirePermission('hr.view', 'settings.view');
const manage = requirePermission('hr.manage', 'settings.edit');
const payroll = requirePermission('hr.payroll', 'settings.edit');
const attendance = requirePermission('hr.attendance', 'hr.manage', 'settings.edit');

/* ------------------------------ Employees ------------------------------ */

router.get('/employees', view, async (req, res, next) => {
  try {
    const { search, status, department, page = 1, limit = 100 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { designation: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await Employee.countDocuments(query);
    const data = await Employee.find(query).sort({ name: 1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total });
  } catch (err) { next(err); }
});

router.get('/employees/:id', view, async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    const salary = await SalaryRecord.find({ employee: employee._id }).sort({ month: -1 }).limit(24);
    const attendance = await Attendance.find({ employee: employee._id }).sort({ date: -1 }).limit(31);
    res.json({ success: true, data: { employee, salary, attendance } });
  } catch (err) { next(err); }
});

router.post('/employees', manage, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Employee name is required' });
    const employee = await Employee.create({ ...req.body, createdBy: req.userId });
    audit.record(req, { action: 'hr.employee.create', entity: 'employee', entityId: employee._id, meta: { name } });
    res.status(201).json({ success: true, data: employee });
  } catch (err) { next(err); }
});

router.put('/employees/:id', manage, async (req, res, next) => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    audit.record(req, { action: 'hr.employee.update', entity: 'employee', entityId: employee._id });
    res.json({ success: true, data: employee });
  } catch (err) { next(err); }
});

router.delete('/employees/:id', manage, async (req, res, next) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    await SalaryRecord.deleteMany({ employee: employee._id });
    await Attendance.deleteMany({ employee: employee._id });
    audit.record(req, { action: 'hr.employee.delete', entity: 'employee', entityId: employee._id });
    res.json({ success: true, message: 'Employee deleted' });
  } catch (err) { next(err); }
});

/* ------------------------------- Salary -------------------------------- */

router.get('/salary', payroll, async (req, res, next) => {
  try {
    const { month, status, employee } = req.query;
    const query = {};
    if (month) query.month = month;
    if (status) query.status = status;
    if (employee) query.employee = employee;
    const data = await SalaryRecord.find(query).sort({ month: -1, employeeName: 1 });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/salary/generate', payroll, async (req, res, next) => {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ success: false, message: 'month (YYYY-MM) is required' });
    const employees = await Employee.find({ status: 'active' });
    let created = 0;
    let skipped = 0;
    for (const emp of employees) {
      const exists = await SalaryRecord.findOne({ employee: emp._id, month });
      if (exists) { skipped++; continue; }
      await SalaryRecord.create({
        employee: emp._id,
        employeeName: emp.name,
        month,
        basic: emp.salary || 0,
        allowances: 0,
        deductions: 0,
        netPay: emp.salary || 0,
        status: 'pending',
        branch: emp.branch,
        createdBy: req.userId,
      });
      created++;
    }
    audit.record(req, { action: 'hr.salary.generate', entity: 'salary', meta: { month, created, skipped } });
    res.json({ success: true, data: { created, skipped } });
  } catch (err) { next(err); }
});

router.post('/salary', payroll, async (req, res, next) => {
  try {
    const { employee, month, basic = 0, allowances = 0, deductions = 0 } = req.body;
    if (!employee || !month) return res.status(400).json({ success: false, message: 'employee and month are required' });
    const emp = await Employee.findById(employee);
    const netPay = Number(basic) + Number(allowances) - Number(deductions);
    const record = await SalaryRecord.findOneAndUpdate(
      { employee, month },
      { employeeName: emp ? emp.name : '', month, basic, allowances, deductions, netPay, branch: emp ? emp.branch : undefined, createdBy: req.userId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    audit.record(req, { action: 'hr.salary.save', entity: 'salary', entityId: record._id });
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

router.put('/salary/:id', payroll, async (req, res, next) => {
  try {
    const record = await SalaryRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Salary record not found' });
    const { basic, allowances, deductions, status, paymentMode, note } = req.body;
    if (basic !== undefined) record.basic = basic;
    if (allowances !== undefined) record.allowances = allowances;
    if (deductions !== undefined) record.deductions = deductions;
    if (paymentMode !== undefined) record.paymentMode = paymentMode;
    if (note !== undefined) record.note = note;
    record.netPay = Number(record.basic) + Number(record.allowances) - Number(record.deductions);
    if (status !== undefined) {
      record.status = status;
      record.paidAt = status === 'paid' ? new Date() : null;
    }
    await record.save();
    audit.record(req, { action: 'hr.salary.update', entity: 'salary', entityId: record._id, meta: { status: record.status } });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

router.delete('/salary/:id', payroll, async (req, res, next) => {
  try {
    await SalaryRecord.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Salary record deleted' });
  } catch (err) { next(err); }
});

/* ----------------------------- Attendance ------------------------------ */

router.get('/attendance', view, async (req, res, next) => {
  try {
    const { date, employee } = req.query;
    const query = {};
    if (date) query.date = date;
    if (employee) query.employee = employee;
    const data = await Attendance.find(query).sort({ date: -1, employeeName: 1 });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/attendance', attendance, async (req, res, next) => {
  try {
    const { employee, date, status = 'present', note = '' } = req.body;
    if (!employee || !date) return res.status(400).json({ success: false, message: 'employee and date are required' });
    const emp = await Employee.findById(employee);
    const record = await Attendance.findOneAndUpdate(
      { employee, date },
      { employeeName: emp ? emp.name : '', date, status, note, branch: emp ? emp.branch : undefined, createdBy: req.userId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

router.delete('/attendance/:id', attendance, async (req, res, next) => {
  try {
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Attendance removed' });
  } catch (err) { next(err); }
});

/* ------------------------------ Summary -------------------------------- */

router.get('/summary', view, async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [headcount, activeCount] = await Promise.all([
      Employee.countDocuments({}),
      Employee.countDocuments({ status: 'active' }),
    ]);
    const activeEmployees = await Employee.find({ status: 'active' });
    const monthlyPayroll = activeEmployees.reduce((s, e) => s + (e.salaryType === 'monthly' ? (e.salary || 0) : 0), 0);
    const salaryRows = await SalaryRecord.find({ month });
    const paid = salaryRows.filter((r) => r.status === 'paid');
    const pending = salaryRows.filter((r) => r.status === 'pending');
    res.json({
      success: true,
      data: {
        month,
        headcount,
        activeCount,
        monthlyPayroll,
        salaryRecords: salaryRows.length,
        paidAmount: paid.reduce((s, r) => s + (r.netPay || 0), 0),
        pendingAmount: pending.reduce((s, r) => s + (r.netPay || 0), 0),
        pendingCount: pending.length,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
