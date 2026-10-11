const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Branch = require('../models/Branch');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

const DEFAULT_PERMISSIONS = {
  superadmin: ['*'],
  admin: [
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
  ],
  manager: [
    'sales.create', 'sales.view', 'sales.hold', 'sales.park',
    'products.view', 'products.edit',
    'categories.view', 'categories.edit',
    'customers.create', 'customers.view', 'customers.edit',
    'purchases.create', 'purchases.view', 'purchases.edit',
    'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'reports.view', 'reports.export',
    'users.view',
    'branches.view',
    'settings.view',
    'dashboard.view'
  ],
  cashier: [
    'sales.create', 'sales.view', 'sales.hold', 'sales.park',
    'products.view',
    'categories.view',
    'customers.create', 'customers.view',
    'purchases.view',
    'inventory.view',
    'dashboard.view'
  ]
};

router.get('/', requireRoles('superadmin', 'admin', 'manager'), async (req, res, next) => {
  try {
    let query = {};
    if (req.userRole === 'manager' && req.userBranch) {
      query.branch = req.userBranch;
    }
    const users = await User.find(query).select('-passwordHash -pin').populate('branch', 'name code').sort({ createdAt: -1 });
    res.json({ success: true, data: users.map(u => u.toSafeJSON()) });
  } catch (err) {
    next(err);
  }
});

router.get('/permissions', async (req, res) => {
  res.json({ success: true, data: DEFAULT_PERMISSIONS });
});

router.post('/', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const { name, username, email, password, role, branch, permissions, active, pin } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: 'name, username and password are required' });
    }
    const exists = await User.findOne({ username: String(username).toLowerCase() });
    if (exists) return res.status(409).json({ success: false, message: 'Username already exists' });
    
    let userBranch = branch;
    if (req.userRole === 'admin' && !branch) {
      userBranch = req.userBranch;
    }
    
    if (userBranch) {
      const branchDoc = await Branch.findById(userBranch);
      if (!branchDoc) return res.status(400).json({ success: false, message: 'Invalid branch' });
    }

    const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 10);
    const pinHash = pin ? await bcrypt.hash(pin, Number(process.env.BCRYPT_ROUNDS) || 10) : undefined;
    
    const userRole = req.userRole === 'superadmin' ? (role || 'cashier') : (role === 'superadmin' || role === 'admin' ? 'cashier' : role || 'cashier');
    
    const user = await User.create({
      name,
      username,
      email,
      passwordHash,
      pin: pinHash,
      role: userRole,
      branch: userBranch || undefined,
      permissions: permissions || DEFAULT_PERMISSIONS[userRole] || DEFAULT_PERMISSIONS.cashier,
      active: active !== false,
    });
    res.status(201).json({ success: true, data: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRoles('superadmin', 'admin', 'manager'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (req.userRole === 'manager' && user.branch?.toString() !== req.userBranch) {
      return res.status(403).json({ success: false, message: 'Cannot edit users from other branches' });
    }

    if (req.body.name) user.name = req.body.name;
    if (req.body.email !== undefined) user.email = req.body.email;
    if (req.body.active !== undefined) user.active = !!req.body.active;
    if (req.body.branch && (req.userRole === 'superadmin' || req.userRole === 'admin')) {
      const branchDoc = await Branch.findById(req.body.branch);
      if (!branchDoc) return res.status(400).json({ success: false, message: 'Invalid branch' });
      user.branch = req.body.branch;
    }
    if (req.body.role && req.userRole === 'superadmin') {
      user.role = req.body.role;
      if (!req.body.permissions) {
        user.permissions = DEFAULT_PERMISSIONS[req.body.role] || DEFAULT_PERMISSIONS.cashier;
      }
    }
    if (req.body.permissions && req.userRole === 'superadmin') {
      user.permissions = req.body.permissions;
    }
    if (req.body.password && req.body.password.length >= 6) {
      user.passwordHash = await bcrypt.hash(req.body.password, Number(process.env.BCRYPT_ROUNDS) || 10);
    }
    if (req.body.pin !== undefined) {
      user.pin = req.body.pin ? await bcrypt.hash(req.body.pin, Number(process.env.BCRYPT_ROUNDS) || 10) : undefined;
    }
    await user.save();
    res.json({ success: true, data: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRoles('superadmin'), async (req, res, next) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;