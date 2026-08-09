const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true, sparse: true, index: true },
    syncedFromCloud: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    totalPurchases: { type: Number, default: 0 },
    lastPurchaseAt: { type: Date },
  },
  { timestamps: true }
);

customerSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id,
    clientId: this.clientId || '',
    name: this.name,
    mobile: this.mobile || '',
    email: this.email || '',
    address: this.address || '',
    gstNumber: this.gstNumber || '',
    totalPurchases: this.totalPurchases,
    lastPurchaseAt: this.lastPurchaseAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Customer', customerSchema);
