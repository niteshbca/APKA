const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const licenseSchema = new mongoose.Schema(
  {
    licenseId: { type: String, required: true, unique: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    businessName: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'suspended', 'expired', 'inactive'], default: 'active' },
    maxDevices: { type: Number, default: 1, min: 1 },
    issuedAt: { type: Date, default: Date.now },
    lastValidatedAt: { type: Date },
    signature: { type: String },
    publicKeyId: { type: String, default: 'pos-rsa-1' },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

licenseSchema.index({ status: 1 });
licenseSchema.index({ expiryDate: 1 });
licenseSchema.plugin(tenantPlugin);

module.exports = mongoose.model('License', licenseSchema);
