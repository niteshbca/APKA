const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const productSchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true, sparse: true, index: true },
    categoryClientId: { type: String, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    syncedFromCloud: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true, index: true },
    // SKU / barcode uniqueness is per-tenant (compound index at the bottom).
    sku: { type: String, required: true, trim: true },
    barcode: { type: String, sparse: true, trim: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
    categoryName: { type: String, trim: true },
    image: { type: String, trim: true },
    purchasePrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    // Optional offer/MRP price used by label printing and promotions.
    mrp: { type: Number, min: 0 },
    offerPrice: { type: Number, min: 0 },
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    hsnCode: { type: String, trim: true, default: '' },
    unit: { type: String, trim: true, default: 'PCS' },
    brandClientId: { type: String, index: true, default: '' },
    brandName: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    // Label-relevant optional attributes.
    variant: { type: String, trim: true, default: '' },
    size: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    batchNo: { type: String, trim: true, default: '' },
    lotNumber: { type: String, trim: true, default: '' },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date },
    trackBatches: { type: Boolean, default: false },
    stock: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 5 },
    isLowStock: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', sku: 'text', barcode: 'text' });
productSchema.index({ tenant: 1, sku: 1 }, { unique: true });
productSchema.index({ tenant: 1, barcode: 1 }, { unique: true, sparse: true });
productSchema.plugin(tenantPlugin);

productSchema.methods.toSafeJSON = function () {
  const isLow = this.stock <= this.minStock;
  return {
    _id: this._id,
    clientId: this.clientId || '',
    categoryClientId: this.categoryClientId || '',
    branch: this.branch,
    name: this.name,
    sku: this.sku,
    barcode: this.barcode || '',
    category: this.category,
    categoryName: this.categoryName || '',
    image: this.image || '',
    purchasePrice: this.purchasePrice,
    sellingPrice: this.sellingPrice,
    mrp: this.mrp,
    offerPrice: this.offerPrice,
    gstRate: this.gstRate,
    hsnCode: this.hsnCode || '',
    unit: this.unit || 'PCS',
    brandClientId: this.brandClientId || '',
    brandName: this.brandName || '',
    description: this.description || '',
    variant: this.variant || '',
    size: this.size || '',
    color: this.color || '',
    batchNo: this.batchNo || '',
    lotNumber: this.lotNumber || '',
    manufacturingDate: this.manufacturingDate,
    expiryDate: this.expiryDate,
    trackBatches: this.trackBatches,
    stock: this.stock,
    minStock: this.minStock,
    isLowStock: this.isLowStock || isLow,
    active: this.active,
    tenant: this.tenant,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Product', productSchema);
