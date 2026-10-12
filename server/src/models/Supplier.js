const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const supplierSchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true, sparse: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    gstin: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    creditLimit: { type: Number, default: 0 },
    openingBalance: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.index({ tenant: 1, name: 1 });
supplierSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Supplier', supplierSchema);
