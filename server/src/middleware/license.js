const License = require('../models/License');

/**
 * Server-side license / subscription enforcement for protected business routes.
 *
 * Two complementary mechanisms, chosen per tenant:
 *   1. Legacy signed-license system — if the tenant already has License
 *      documents, the original behaviour is preserved exactly: at least one
 *      active, non-expired License must exist (DEFAULT_LICENSE_ID may pin one).
 *   2. Tenant subscription lifecycle — tenants onboarded through SaaS signup
 *      (no signed License docs) are gated on their subscription: an active
 *      trial (not past trial end) or an active paid plan may transact.
 *
 * License queries are automatically scoped to the current tenant by the shared
 * tenant plugin, so one tenant's license can never authorise another tenant.
 */
async function licenseGuard(req, res, next) {
  try {
    const now = new Date();

    // Does this tenant use the legacy signed-license system?
    const legacyCount = await License.countDocuments({});

    if (legacyCount === 0) {
      const tenant = req.tenantDoc;
      if (tenant && !req.isPlatformAdmin) {
        if (tenant.status === 'trial') {
          if (tenant.trialEndsAt && new Date(tenant.trialEndsAt) < now) {
            return res.status(403).json({
              success: false,
              code: 'TRIAL_EXPIRED',
              message: 'Your trial has expired. Please subscribe to continue.',
            });
          }
          req.license = { mode: 'trial', tenant };
          return next();
        }
        if (tenant.status === 'active') {
          req.license = { mode: 'subscription', tenant };
          return next();
        }
        return res.status(403).json({
          success: false,
          code: 'SUBSCRIPTION_INACTIVE',
          message: `Your subscription is ${tenant.status}. Please renew to continue.`,
        });
      }
    }

    // Legacy signed-license enforcement (tenant-scoped by the plugin).
    let license = null;
    if (process.env.DEFAULT_LICENSE_ID) {
      license = await License.findOne({ licenseId: process.env.DEFAULT_LICENSE_ID });
      if (!license) {
        return res.status(403).json({ success: false, code: 'LICENSE_NOT_FOUND', message: 'License not found.' });
      }
    } else {
      license = await License.findOne({ status: 'active', expiryDate: { $gte: now } });
    }

    if (!license || new Date(license.expiryDate) < now) {
      if (license && license.status !== 'expired') {
        license.status = 'expired';
        await license.save();
      }
      return res.status(403).json({
        success: false,
        code: 'LICENSE_EXPIRED',
        message: 'Your software license has expired. Please renew your license.',
      });
    }

    if (license.status === 'suspended') {
      return res.status(403).json({ success: false, code: 'LICENSE_SUSPENDED', message: 'License suspended.' });
    }
    if (license.status !== 'active') {
      return res.status(403).json({ success: false, code: 'LICENSE_' + license.status.toUpperCase(), message: 'License is ' + license.status + '.' });
    }

    req.license = license;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { licenseGuard };
