const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, default: 'business' },
    businessName: { type: String, default: 'My Business' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    gstin: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    footerNote: { type: String, default: 'Thank you for your purchase!' },
    thermalWidth: { type: String, enum: ['58mm', '80mm'], default: '80mm' },
    currency: { type: String, default: '₹' },
    invoicePrefix: { type: String, default: 'INV' },
    // Tenant branding/tax/inventory defaults (safe, additive).
    taxLabel: { type: String, default: 'GST' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    financialYear: { type: String, default: '' },
    allowNegativeStock: { type: Boolean, default: false },
    labelDefaults: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

settingsSchema.index({ tenant: 1, key: 1 }, { unique: true });
settingsSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Setting', settingsSchema);
