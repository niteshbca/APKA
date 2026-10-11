const jwt = require('jsonwebtoken');
const User = require('../models/User');

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.sub;
    req.userRole = decoded.role;
    req.userBranch = decoded.branch;
    req.userPermissions = decoded.permissions || [];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

async function attachUser(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('branch permissions role active').populate('branch', 'name code isActive');
    if (user) {
      req.userDoc = user;
      req.userBranch = user.branch?._id || user.branch;
      req.userPermissions = user.permissions || [];
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requirePermission(...perms) {
  return (req, res, next) => {
    if (req.userRole === 'superadmin') return next();
    const hasPerm = perms.some(p => req.userPermissions.includes(p) || req.userPermissions.includes('*'));
    if (!hasPerm) {
      return res.status(403).json({ success: false, message: `Permission required: ${perms.join(' or ')}` });
    }
    next();
  };
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

function requireBranchAccess() {
  return (req, res, next) => {
    if (req.userRole === 'superadmin') return next();
    if (!req.userBranch) {
      return res.status(403).json({ success: false, message: 'No branch assigned' });
    }
    next();
  };
}

module.exports = { verifyToken, requireRoles, requirePermission, requireBranchAccess, attachUser };
