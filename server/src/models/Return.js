const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

/**
 * Returns & Udhaar ledger.
 *
 *  kind = 'return'  → a product return / refund (money goes back to customer)
 *  kind = 'udhaar'  → credit given to a customer (customer owes us)
 *  kind = 'payment' → amount recovered against an outstanding udhaar
 */
const returnSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['return', 'udhaar', 'payment'], default: 'return', index: true },
    customerName: { type: String, trim: true, default: '' },
    customerMobile: { type: String, trim: true, default: '' },
    invoiceNo: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0 },
    reason: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['open', 'settled'], default: 'open', index: true },
    date: { type: Date, default: Date.now, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

returnSchema.index({ tenant: 1, kind: 1, date: -1 });
returnSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Return', returnSchema);
