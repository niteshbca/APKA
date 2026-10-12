const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

/**
 * Audit trail of every label print / reprint. Lets the UI show print history
 * and lets authorised managers audit reprints (e.g. to detect price-labeling
 * abuse).
 */
const labelPrintLogSchema = new mongoose.Schema(
  {
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'LabelTemplate' },
    templateName: { type: String, trim: true, default: '' },
    mode: { type: String, enum: ['product', 'category', 'selection', 'search', 'single'], default: 'product' },
    reprint: { type: Boolean, default: false },
    itemCount: { type: Number, default: 0 },
    labelCount: { type: Number, default: 0 },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productClientId: { type: String },
        name: { type: String },
        sku: { type: String },
        barcode: { type: String },
        qty: { type: Number },
      },
    ],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, trim: true, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

labelPrintLogSchema.index({ createdAt: -1 });
labelPrintLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('LabelPrintLog', labelPrintLogSchema);
