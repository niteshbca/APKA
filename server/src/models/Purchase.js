const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const purchaseSchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true, sparse: true, index: true },
    productClientId: { type: String, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    syncedFromCloud: { type: Boolean, default: false },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    supplierName: { type: String, trim: true },
    type: { type: String, enum: ['purchase', 'opening', 'adjustment'], default: 'purchase' },
    qty: { type: Number, required: true },
    costPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, default: 0 },
    note: { type: String, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, trim: true },
  },
  { timestamps: true }
);

purchaseSchema.index({ createdAt: -1 });
purchaseSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Purchase', purchaseSchema);
