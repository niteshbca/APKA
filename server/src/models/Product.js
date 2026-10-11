const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true, sparse: true, index: true },
    categoryClientId: { type: String, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    syncedFromCloud: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, trim: true },
    barcode: { type: String, unique: true, sparse: true, trim: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
    categoryName: { type: String, trim: true },
    image: { type: String, trim: true },
    purchasePrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 5 },
    isLowStock: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', sku: 'text', barcode: 'text' });

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
    gstRate: this.gstRate,
    stock: this.stock,
    minStock: this.minStock,
    isLowStock: this.isLowStock || isLow,
    active: this.active,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Product', productSchema);
