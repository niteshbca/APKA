const License = require('../models/License');

/**
 * Server-side license enforcement for protected business routes.
 * - If DEFAULT_LICENSE_ID is set, that specific license must be valid.
 * - Otherwise at least one active, non-expired license must exist.
 * This is the "backend/local application architecture" anti-bypass layer:
 * even if the client is tampered with, the server refuses to persist sales
 * when the license is missing/expired/suspended.
 */
async function licenseGuard(req, res, next) {
  try {
    const now = new Date();
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
