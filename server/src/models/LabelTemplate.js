const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

/**
 * A reusable label template. Field ordering, font size and alignment are
 * configurable per label; sizes support the common retail label papers
 * (50x25, 50x30, 40x30, 60x40 mm) plus custom dimensions.
 */
const labelFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    fontSize: { type: Number, default: 8, min: 4, max: 40 },
    align: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    bold: { type: Boolean, default: false },
  },
  { _id: false }
);

const labelTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    preset: { type: String, trim: true, default: 'custom' },
    size: {
      widthMm: { type: Number, required: true, min: 10, max: 300, default: 50 },
      heightMm: { type: Number, required: true, min: 10, max: 300, default: 25 },
    },
    columns: { type: Number, default: 1, min: 1, max: 10 },
    gapXMm: { type: Number, default: 2, min: 0, max: 50 },
    gapYMm: { type: Number, default: 2, min: 0, max: 50 },
    marginMm: { type: Number, default: 0, min: 0, max: 50 },
    showBorder: { type: Boolean, default: true },
    barcodeType: { type: String, enum: ['auto', 'code128', 'ean13', 'none'], default: 'auto' },
    showQr: { type: Boolean, default: false },
    showLogo: { type: Boolean, default: false },
    fields: { type: [labelFieldSchema], default: [] },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

labelTemplateSchema.index({ tenant: 1, name: 1 });
labelTemplateSchema.plugin(tenantPlugin);

module.exports = mongoose.model('LabelTemplate', labelTemplateSchema);
