const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productClientId: { type: String, index: true },
    name: { type: String, required: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    lineDiscount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true, trim: true },
    clientSaleId: { type: String, unique: true, sparse: true },
    clientDeviceId: { type: String, index: true },
    customerClientId: { type: String, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerSnapshot: {
      name: { type: String, trim: true },
      mobile: { type: String, trim: true },
      gstNumber: { type: String, trim: true },
      address: { type: String, trim: true },
    },
    items: { type: [saleItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxable: { type: Number, default: 0 },
    gstTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMode: { type: String, enum: ['cash', 'upi', 'card'], required: true },
    amountReceived: { type: Number, default: 0 },
    changeDue: { type: Number, default: 0 },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cashierName: { type: String, trim: true },
    deviceId: { type: String, index: true },
    syncSource: { type: String, enum: ['online', 'offline', 'push'], default: 'online' },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ paymentMode: 1, createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
