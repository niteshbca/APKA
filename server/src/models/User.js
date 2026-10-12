const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const tenantPlugin = require('../plugins/tenantPlugin');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['superadmin', 'admin', 'manager', 'cashier'], default: 'cashier' },
    // Platform administrator: manages ALL tenants. Distinct from tenant-level
    // administration (role: admin scoped to a single tenant).
    isPlatformAdmin: { type: Boolean, default: false, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    // Permission strings are validated against config/permissions.js in the
    // API layer rather than a hard enum, so new modules can add permissions
    // without a migration.
    permissions: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date },
    pin: { type: String, select: false },
  },
  { timestamps: true }
);

userSchema.plugin(tenantPlugin);

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    username: this.username,
    email: this.email,
    role: this.role,
    isPlatformAdmin: !!this.isPlatformAdmin,
    tenant: this.tenant,
    branch: this.branch,
    permissions: this.permissions || [],
    active: this.active,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
