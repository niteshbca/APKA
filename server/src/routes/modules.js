const express = require('express');
const Tenant = require('../models/Tenant');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { MODULES, ALL_KEYS, sanitizeModules } = require('../config/modules');

const router = express.Router();

router.use(verifyToken);

/**
 * Returns the module registry plus the effective set of enabled modules for
 * the signed-in user. The frontend builds its sidebar from this response AND
 * still relies on backend `requireModule`/`requirePermission` guards.
 */
router.get('/', async (req, res, next) => {
  try {
    if (req.isPlatformAdmin) {
      return res.json({ success: true, data: { registry: MODULES, enabled: ALL_KEYS, platform: true } });
    }
    const tenant = req.tenantDoc;
    const configured = (tenant && tenant.enabledModules) || [];
    const enabled = configured.length ? configured : ALL_KEYS;
    res.json({ success: true, data: { registry: MODULES, enabled, platform: false } });
  } catch (err) {
    next(err);
  }
});

/**
 * Enable/disable modules for the current tenant. Restricted to tenant admins
 * (settings.edit) or platform administrators.
 */
router.put('/', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    if (!req.tenantId) return res.status(400).json({ success: false, message: 'No tenant context' });
    const modules = sanitizeModules(req.body.enabledModules);
    if (!modules) return res.status(400).json({ success: false, message: 'enabledModules must be an array' });
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    tenant.enabledModules = modules;
    await tenant.save();
    res.json({ success: true, data: { enabled: tenant.enabledModules } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
