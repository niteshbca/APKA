const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Branch = require('../models/Branch');
const { verifyToken, requireRoles, requirePermission } = require('../middleware/auth');
const { ROLE_TEMPLATES, PERMISSIONS, sanitizePermissions } = require('../config/permissions');
const audit = require('../services/auditService');

const router = express.Router();

router.use(verifyToken);

const ASSIGNABLE_ROLES = ['admin', 'manager', 'cashier'];

router.get('/', requireRoles('superadmin', 'admin', 'manager'), async (req, res, next) => {
  try {
    let query = {};
    if (req.userRole === 'manager' && req.userBranch) {
      query.branch = req.userBranch;
    }
    const users = await User.find(query).select('-passwordHash -pin').populate('branch', 'name code').sort({ createdAt: -1 });
    res.json({ success: true, data: users.map((u) => u.toSafeJSON()) });
  } catch (err) {
    next(err);
  }
});

/** Returns the permission catalog + role templates for the role editor UI. */
router.get('/permissions', (req, res) => {
  res.json({ success: true, data: { permissions: PERMISSIONS, roles: ROLE_TEMPLATES } });
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
    if ((req.userRole === 'admin' || req.isPlatformAdmin) && !branch) {
      userBranch = req.userBranch || undefined;
    }
    if (userBranch) {
      const branchDoc = await Branch.findById(userBranch);
      if (!branchDoc) return res.status(400).json({ success: false, message: 'Invalid branch' });
    }

    // Only platform admins may create superadmins. Tenant admins are limited to
    // admin/manager/cashier inside their own tenant.
    let userRole = ASSIGNABLE_ROLES.includes(role) ? role : 'cashier';
    if (req.isPlatformAdmin && role === 'superadmin') userRole = 'superadmin';

    const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 10);
    const pinHash = pin ? await bcrypt.hash(pin, Number(process.env.BCRYPT_ROUNDS) || 10) : undefined;

    const requestedPerms = Array.isArray(permissions) ? sanitizePermissions(permissions) : null;
    const perms = requestedPerms && requestedPerms.length ? requestedPerms : ROLE_TEMPLATES[userRole] || ROLE_TEMPLATES.cashier;

    const user = await User.create({
      tenant: req.tenantId || undefined,
      name,
      username,
      email,
      passwordHash,
      pin: pinHash,
      role: userRole,
      isPlatformAdmin: false,
      branch: userBranch || undefined,
      permissions: perms,
      active: active !== false,
    });
    audit.record(req, { action: 'user.create', entity: 'User', entityId: user._id, meta: { username: user.username, role: user.role } });
    res.status(201).json({ success: true, data: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRoles('superadmin', 'admin', 'manager'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (req.userRole === 'manager' && String(user.branch || '') !== String(req.userBranch)) {
      return res.status(403).json({ success: false, message: 'Cannot edit users from other branches' });
    }
    // Tenant admins cannot edit platform admins.
    if (user.isPlatformAdmin && !req.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'Cannot edit a platform administrator' });
    }

    if (req.body.name) user.name = req.body.name;
    if (req.body.email !== undefined) user.email = req.body.email;
    if (req.body.active !== undefined) user.active = !!req.body.active;
    if (req.body.branch && (req.userRole === 'superadmin' || req.userRole === 'admin' || req.isPlatformAdmin)) {
      const branchDoc = await Branch.findById(req.body.branch);
      if (!branchDoc) return res.status(400).json({ success: false, message: 'Invalid branch' });
      user.branch = req.body.branch;
    }
    const canManageRoles = req.userRole === 'superadmin' || req.userRole === 'admin' || req.isPlatformAdmin;
    if (req.body.role && canManageRoles) {
      if (req.isPlatformAdmin) {
        user.role = req.body.role;
      } else if (ASSIGNABLE_ROLES.includes(req.body.role)) {
        user.role = req.body.role;
        if (!req.body.permissions) user.permissions = ROLE_TEMPLATES[req.body.role] || ROLE_TEMPLATES.cashier;
      }
    }
    if (req.body.permissions && canManageRoles) {
      user.permissions = sanitizePermissions(req.body.permissions);
    }
    if (req.body.password && req.body.password.length >= 6) {
      user.passwordHash = await bcrypt.hash(req.body.password, Number(process.env.BCRYPT_ROUNDS) || 10);
    }
    if (req.body.pin !== undefined) {
      user.pin = req.body.pin ? await bcrypt.hash(req.body.pin, Number(process.env.BCRYPT_ROUNDS) || 10) : undefined;
    }
    await user.save();
    audit.record(req, { action: 'user.update', entity: 'User', entityId: user._id });
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
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.isPlatformAdmin && !req.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'Cannot delete a platform administrator' });
    }
    await User.findByIdAndDelete(req.params.id);
    audit.record(req, { action: 'user.delete', entity: 'User', entityId: req.params.id });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
