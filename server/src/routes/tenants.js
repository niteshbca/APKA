const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Setting = require('../models/Setting');
const { verifyToken, requirePermission, requirePlatformAdmin } = require('../middleware/auth');
const { defaultEnabledModules, sanitizeModules } = require('../config/modules');
const { PERMISSION_KEYS } = require('../config/permissions');
const { genClientId } = require('../utils/id');

const router = express.Router();

const PLAN_LIMITS = {
  trial: { maxBranches: 1, maxUsers: 5, maxProducts: 500, maxDevices: 1 },
  starter: { maxBranches: 2, maxUsers: 10, maxProducts: 5000, maxDevices: 2 },
  professional: { maxBranches: 10, maxUsers: 50, maxProducts: 50000, maxDevices: 10 },
  enterprise: { maxBranches: 1000, maxUsers: 5000, maxProducts: 1000000, maxDevices: 1000 },
};

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'company';
}

async function uniqueSlug(base) {
  let slug = base;
  let i = 1;
  // Note: Tenant has no tenant scope itself, so this is a global uniqueness check.
  while (await Tenant.findOne({ slug })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

function issueToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      branch: user.branch || null,
      tenant: user.tenant || null,
      isPlatformAdmin: !!user.isPlatformAdmin,
      permissions: user.permissions,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * PUBLIC onboarding: self-service tenant registration.
 * Creates the tenant, an owner (tenant admin), a main branch and settings.
 */
router.post('/register', async (req, res, next) => {
  try {
    const { companyName, ownerName, username, email, password, phone, plan = 'trial' } = req.body;
    if (!companyName || !ownerName || !username || !password) {
      return res.status(400).json({ success: false, message: 'companyName, ownerName, username and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const uname = String(username).toLowerCase().trim();
    if (await User.findOne({ username: uname })) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    const slug = await uniqueSlug(slugify(companyName));
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
    const trialEndsAt = plan === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : undefined;

    const tenant = await Tenant.create({
      clientId: genClientId('ten'),
      name: companyName,
      slug,
      email: email || '',
      phone: phone || '',
      status: plan === 'trial' ? 'trial' : 'active',
      plan,
      trialEndsAt,
      enabledModules: defaultEnabledModules(),
      limits,
    });

    const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 10);
    const owner = await User.create({
      tenant: tenant._id,
      name: ownerName,
      username: uname,
      email: email || '',
      passwordHash,
      role: 'admin',
      isPlatformAdmin: false,
      permissions: PERMISSION_KEYS,
      active: true,
      lastLogin: new Date(),
    });

    tenant.owner = owner._id;
    await tenant.save();

    const branch = await Branch.create({
      tenant: tenant._id,
      clientId: genClientId('br'),
      name: 'Head Office',
      code: 'MAIN',
      email: email || '',
      phone: phone || '',
      isMain: true,
    });
    owner.branch = branch._id;
    await owner.save();

    await Setting.create({
      tenant: tenant._id,
      key: 'business',
      businessName: companyName,
      email: email || '',
      phone: phone || '',
      currency: '₹',
    });

    const token = issueToken(owner);
    res.status(201).json({ success: true, token, user: owner.toSafeJSON(), tenant });
  } catch (err) {
    next(err);
  }
});

router.use(verifyToken);

/** Current tenant profile (settings, plan, limits, modules) for the user. */
router.get('/me', async (req, res, next) => {
  try {
    if (req.isPlatformAdmin && !req.tenantId) {
      return res.json({ success: true, data: null, platform: true });
    }
    const tenant = req.tenantDoc || (req.tenantId ? await Tenant.findById(req.tenantId) : null);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    res.json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

/** Update tenant profile/branding/settings (tenant admin). */
router.put('/me', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    if (!req.tenantId) return res.status(400).json({ success: false, message: 'No tenant context' });
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    if (req.body.name !== undefined) tenant.name = req.body.name;
    if (req.body.legalName !== undefined) tenant.legalName = req.body.legalName;
    if (req.body.email !== undefined) tenant.email = req.body.email;
    if (req.body.phone !== undefined) tenant.phone = req.body.phone;
    if (req.body.gstin !== undefined) tenant.gstin = req.body.gstin;
    if (req.body.settings && typeof req.body.settings === 'object') {
      tenant.settings = { ...tenant.settings, ...req.body.settings };
    }
    await tenant.save();
    res.json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

// ============================ Platform administration ============================
// Global platform management is completely separate from tenant administration.

router.get('/platform/list', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { slug: { $regex: search, $options: 'i' } }];
    const total = await Tenant.countDocuments(query);
    const data = await Tenant.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

router.post('/platform', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { companyName, ownerName, username, email, password, phone, plan = 'starter' } = req.body;
    if (!companyName || !ownerName || !username || !password) {
      return res.status(400).json({ success: false, message: 'companyName, ownerName, username and password are required' });
    }
    const uname = String(username).toLowerCase().trim();
    if (await User.findOne({ username: uname })) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }
    const slug = await uniqueSlug(slugify(companyName));
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    const tenant = await Tenant.create({
      clientId: genClientId('ten'),
      name: companyName,
      slug,
      email: email || '',
      phone: phone || '',
      status: 'active',
      plan,
      enabledModules: defaultEnabledModules(),
      limits,
    });
    const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 10);
    const owner = await User.create({
      tenant: tenant._id,
      name: ownerName,
      username: uname,
      email: email || '',
      passwordHash,
      role: 'admin',
      permissions: PERMISSION_KEYS,
      active: true,
    });
    tenant.owner = owner._id;
    await tenant.save();
    const branch = await Branch.create({ tenant: tenant._id, clientId: genClientId('br'), name: 'Head Office', code: 'MAIN', isMain: true });
    owner.branch = branch._id;
    await owner.save();
    await Setting.create({ tenant: tenant._id, key: 'business', businessName: companyName });
    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

router.get('/platform/:id', requirePlatformAdmin, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid tenant id' });
    }
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const userCount = await User.countDocuments({ tenant: tenant._id });
    const branchCount = await Branch.countDocuments({ tenant: tenant._id });
    res.json({ success: true, data: tenant, stats: { users: userCount, branches: branchCount } });
  } catch (err) {
    next(err);
  }
});

router.put('/platform/:id', requirePlatformAdmin, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid tenant id' });
    }
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    if (req.body.status !== undefined) tenant.status = req.body.status;
    if (req.body.plan !== undefined) {
      tenant.plan = req.body.plan;
      if (PLAN_LIMITS[req.body.plan]) tenant.limits = { ...tenant.limits, ...PLAN_LIMITS[req.body.plan] };
    }
    if (req.body.settings && typeof req.body.settings === 'object') {
      tenant.settings = { ...tenant.settings, ...req.body.settings };
    }
    if (req.body.limits && typeof req.body.limits === 'object') {
      tenant.limits = { ...tenant.limits, ...req.body.limits };
    }
    if (req.body.enabledModules !== undefined) {
      const modules = sanitizeModules(req.body.enabledModules);
      if (modules) tenant.enabledModules = modules;
    }
    await tenant.save();
    res.json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
