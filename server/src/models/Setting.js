const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'business' },
    businessName: { type: String, default: 'My Business' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    gstin: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    footerNote: { type: String, default: 'Thank you for your purchase!' },
    thermalWidth: { type: String, enum: ['58mm', '80mm'], default: '80mm' },
    currency: { type: String, default: '₹' },
    invoicePrefix: { type: String, default: 'INV' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingsSchema);
