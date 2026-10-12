const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const branchSchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    gstin: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isMain: { type: Boolean, default: false },
    settings: {
      currency: { type: String, default: 'INR' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      invoicePrefix: { type: String, default: 'INV' },
      enableGst: { type: Boolean, default: true },
      lowStockThreshold: { type: Number, default: 10 },
    },
  },
  { timestamps: true }
);

branchSchema.pre('save', function (next) {
  if (!this.clientId) {
    this.clientId = 'br_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  next();
});

branchSchema.index({ tenant: 1, code: 1 }, { unique: true });
branchSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Branch', branchSchema);