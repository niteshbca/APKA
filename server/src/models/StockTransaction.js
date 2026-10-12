const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const stockTransactionSchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true, sparse: true, index: true },
    productClientId: { type: String, index: true },
    syncedFromCloud: { type: Boolean, default: false },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    name: { type: String, trim: true },
    sku: { type: String, trim: true },
    type: { type: String, enum: ['sale', 'purchase', 'adjustment', 'opening'], required: true },
    qty: { type: Number, required: true },
    previousStock: { type: Number, default: 0 },
    newStock: { type: Number, default: 0 },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, trim: true },
    deviceId: { type: String, index: true },
  },
  { timestamps: true }
);

stockTransactionSchema.index({ createdAt: -1 });
stockTransactionSchema.index({ product: 1, createdAt: -1 });
stockTransactionSchema.plugin(tenantPlugin);

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
