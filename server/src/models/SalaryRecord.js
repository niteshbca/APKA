const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const salaryRecordSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    employeeName: { type: String, trim: true, default: '' },
    month: { type: String, required: true, index: true }, // YYYY-MM
    basic: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending', index: true },
    paidAt: { type: Date },
    paymentMode: { type: String, trim: true, default: 'cash' },
    note: { type: String, trim: true, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

salaryRecordSchema.index({ tenant: 1, employee: 1, month: 1 }, { unique: true });
salaryRecordSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SalaryRecord', salaryRecordSchema);
