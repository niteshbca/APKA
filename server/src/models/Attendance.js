const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    employeeName: { type: String, trim: true, default: '' },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    status: { type: String, enum: ['present', 'absent', 'half_day', 'leave'], default: 'present' },
    note: { type: String, trim: true, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

attendanceSchema.index({ tenant: 1, employee: 1, date: 1 }, { unique: true });
attendanceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Attendance', attendanceSchema);
