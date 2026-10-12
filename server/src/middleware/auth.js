const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { runWithTenant } = require('../config/tenantContext');

/**
 * Verifies the JWT, loads the *current* user from the database (so revoked
 * permissions/roles take effect immediately), resolves the tenant from the
 * authenticated membership — NEVER from client-supplied tenant_id — and runs
 * the rest of the request inside the AsyncLocalStorage tenant scope so every
 * Mongoose query is automatically filtered by tenant.
 */
async function buildContext(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    const err = new Error('Invalid or expired token');
    err.status = 401;
    throw err;
  }

  const user = await User.findById(decoded.sub).select('name branch permissions role active tenant isPlatformAdmin');
  if (!user || !user.active) {
    const err = new Error('Invalid or inactive account');
    err.status = 401;
    throw err;
  }

  req.userId = String(user._id);
  req.userRole = user.role;
  req.userBranch = user.branch ? String(user.branch) : null;
  req.userPermissions = user.permissions || [];
  req.userDoc = user;

  let tenantId = null;
  let bypass = false;

  if (user.isPlatformAdmin) {
    // Platform admins may target a specific tenant via an explicit header.
    const requested = req.headers['x-tenant-id'] || req.query.tenantId;
    if (requested && mongoose.Types.ObjectId.isValid(String(requested))) {
      const t = await Tenant.findById(requested).select('_id status enabledModules settings limits');
      if (t) {
        tenantId = String(t._id);
        req.tenantDoc = t;
      }
    } else {
      // Global platform view: no tenant filter (manages all tenants).
      bypass = true;
    }
  } else {
    tenantId = user.tenant ? String(user.tenant) : null;
    if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
      const t = await Tenant.findById(tenantId).select('_id status enabledModules settings limits');
      if (t) {
        req.tenantDoc = t;
        if (['suspended', 'archived'].includes(t.status)) {
          const err = new Error('Your company account is ' + t.status + '. Please contact support.');
          err.status = 403;
          err.code = 'TENANT_SUSPENDED';
          throw err;
        }
      }
    }
  }

  req.tenantId = tenantId;
  req.isPlatformAdmin = !!user.isPlatformAdmin;
  return { tenantId, bypass, user };
}

function verifyToken(req, res, next) {
  buildContext(req)
    .then((ctx) => {
      runWithTenant(
        { tenantId: ctx.tenantId, bypass: ctx.bypass, userId: String(ctx.user._id) },
        () => next()
      );
    })
    .catch(next);
}

// Backwards-compatible helper (kept for any external callers). Context is now
// already attached by verifyToken.
async function attachUser(req, res, next) {
  try {
    if (!req.userDoc && req.userId) {
      const user = await User.findById(req.userId).select('branch permissions role active tenant isPlatformAdmin');
      if (user) {
        req.userDoc = user;
        req.userBranch = user.branch?._id || user.branch;
        req.userPermissions = user.permissions || [];
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requirePermission(...perms) {
  return (req, res, next) => {
    if (req.userRole === 'superadmin' || req.isPlatformAdmin) return next();
    const hasPerm = perms.some((p) => req.userPermissions.includes(p) || req.userPermissions.includes('*'));
    if (!hasPerm) {
      return res.status(403).json({ success: false, message: `Permission required: ${perms.join(' or ')}` });
    }
    next();
  };
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (req.isPlatformAdmin) return next();
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

function requirePlatformAdmin(req, res, next) {
  if (!req.isPlatformAdmin) {
    return res.status(403).json({ success: false, message: 'Platform administrator access required' });
  }
  next();
}

/**
 * Blocks access to a module that the tenant's plan/config has disabled.
 * Platform admins bypass this. An empty enabled list means "not configured"
 * (legacy tenants) and is treated as enabled for backward compatibility.
 */
function requireModule(...keys) {
  return (req, res, next) => {
    if (req.isPlatformAdmin) return next();
    const t = req.tenantDoc;
    if (!t) return next();
    const enabled = t.enabledModules || [];
    if (enabled.length === 0) return next();
    if (keys.some((k) => enabled.includes(k))) return next();
    return res.status(403).json({
      success: false,
      code: 'MODULE_DISABLED',
      message: `The '${keys[0]}' module is not enabled for your account.`,
    });
  };
}

function requireBranchAccess() {
  return (req, res, next) => {
    if (req.userRole === 'superadmin' || req.isPlatformAdmin) return next();
    if (!req.userBranch) {
      return res.status(403).json({ success: false, message: 'No branch assigned' });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  requireRoles,
  requirePermission,
  requireBranchAccess,
  requirePlatformAdmin,
  requireModule,
  attachUser,
  buildContext,
};
