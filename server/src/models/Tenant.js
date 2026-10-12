const mongoose = require('mongoose');

/**
 * A Tenant is one independent client company using the platform.
 *
 * The platform uses a SHARED-DATABASE, SHARED-COLLECTION architecture with a
 * mandatory `tenant` discriminator on every business document (enforced by the
 * shared `tenantPlugin`). This was chosen deliberately: it preserves the
 * existing single database + sync architecture, needs no rewrite, and keeps
 * cross-tenant reporting/analytics simple. Tenant isolation is guaranteed at
 * the query layer, not by convention.
 */
const tenantSchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    legalName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    gstin: { type: String, trim: true, default: '' },

    status: {
      type: String,
      enum: ['active', 'trial', 'suspended', 'expired', 'archived'],
      default: 'trial',
      index: true,
    },
    plan: { type: String, trim: true, default: 'trial' },
    trialEndsAt: { type: Date },

    // Enabled modules for this tenant (keys from config/modules.js).
    enabledModules: { type: [String], default: [] },

    limits: {
      maxBranches: { type: Number, default: 3 },
      maxUsers: { type: Number, default: 10 },
      maxProducts: { type: Number, default: 5000 },
      maxDevices: { type: Number, default: 2 },
    },

    settings: {
      currency: { type: String, default: 'INR' },
      currencySymbol: { type: String, default: '₹' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      financialYear: { type: String, default: '' },
      invoicePrefix: { type: String, default: 'INV' },
      enableGst: { type: Boolean, default: true },
      allowNegativeStock: { type: Boolean, default: false },
      lowStockThreshold: { type: Number, default: 10 },
      logoUrl: { type: String, default: '' },
      brandingColor: { type: String, default: '#4f46e5' },
    },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDemo: { type: Boolean, default: false },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

tenantSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Tenant', tenantSchema);
