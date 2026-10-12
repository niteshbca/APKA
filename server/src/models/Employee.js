const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const employeeSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, uppercase: true, default: '' },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    joinDate: { type: Date },
    salaryType: { type: String, enum: ['monthly', 'daily'], default: 'monthly' },
    salary: { type: Number, default: 0 },
    address: { type: String, trim: true },
    bankAccount: { type: String, trim: true },
    ifsc: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    notes: { type: String, trim: true, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

employeeSchema.index({ tenant: 1, code: 1 }, { unique: true, sparse: true });
employeeSchema.index({ tenant: 1, name: 1 });
employeeSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Employee', employeeSchema);
