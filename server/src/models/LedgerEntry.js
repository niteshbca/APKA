const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const ledgerEntrySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['income', 'expense'], required: true, index: true },
    category: { type: String, trim: true, default: '' },
    amount: { type: Number, required: true, default: 0 },
    date: { type: Date, default: Date.now, index: true },
    paymentMode: { type: String, trim: true, default: 'cash' },
    party: { type: String, trim: true, default: '' },
    reference: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ tenant: 1, date: -1 });
ledgerEntrySchema.plugin(tenantPlugin);

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
