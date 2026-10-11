const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['superadmin', 'admin', 'manager', 'cashier'], default: 'cashier' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    permissions: [{
      type: String,
      enum: [
        '*',
        'sales.create', 'sales.view', 'sales.delete', 'sales.hold', 'sales.park',
        'products.create', 'products.view', 'products.edit', 'products.delete',
        'categories.create', 'categories.view', 'categories.edit', 'categories.delete',
        'customers.create', 'customers.view', 'customers.edit', 'customers.delete',
        'purchases.create', 'purchases.view', 'purchases.edit', 'purchases.delete',
        'inventory.view', 'inventory.adjust', 'inventory.transfer',
        'reports.view', 'reports.export',
        'users.create', 'users.view', 'users.edit', 'users.delete',
        'branches.create', 'branches.view', 'branches.edit', 'branches.delete',
        'settings.view', 'settings.edit',
        'dashboard.view', 'license.manage'
      ]
    }],
    active: { type: Boolean, default: true },
    lastLogin: { type: Date },
    pin: { type: String, select: false },
  },
  { timestamps: true }
);

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
    branch: this.branch,
    permissions: this.permissions || [],
    active: this.active,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
