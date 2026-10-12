const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const invoiceItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
    gstRate: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    lineDiscount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, trim: true },
    clientSaleId: { type: String, unique: true, sparse: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    businessName: { type: String, trim: true },
    businessAddress: { type: String, trim: true },
    businessGstin: { type: String, trim: true },
    businessPhone: { type: String, trim: true },
    customerName: { type: String, trim: true },
    customerMobile: { type: String, trim: true },
    customerEmail: { type: String, trim: true, lowercase: true },
    customerGst: { type: String, trim: true },
    customerAddress: { type: String, trim: true },
    items: { type: [invoiceItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxable: { type: Number, default: 0 },
    gstTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMode: { type: String, enum: ['cash', 'upi', 'card'] },
    amountReceived: { type: Number, default: 0 },
    changeDue: { type: Number, default: 0 },
    cashierName: { type: String, trim: true },
    deviceId: { type: String, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ paymentMode: 1, createdAt: -1 });
invoiceSchema.index({ tenant: 1, invoiceNo: 1 }, { unique: true });
invoiceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Invoice', invoiceSchema);
