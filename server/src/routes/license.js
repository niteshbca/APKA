const express = require('express');
const keyService = require('../services/keyService');
const licenseService = require('../services/licenseService');
const Device = require('../models/Device');

const router = express.Router();

/**
 * Public key for the client to verify license signatures offline.
 */
router.get('/public-key', (req, res) => {
  res.json({ success: true, data: { publicKey: keyService.publicKeyPem() } });
});

/**
 * Activate the POS on a device with a license id.
 * Binds the device and returns the signed license payload.
 */
router.post('/activate', async (req, res, next) => {
  try {
    const { licenseId, deviceId, deviceName, platform } = req.body;
    if (!licenseId || !deviceId) {
      return res.status(400).json({ success: false, message: 'licenseId and deviceId are required' });
    }
    const result = await licenseService.bindDevice(licenseId, deviceId, deviceName, platform);
    if (!result.ok) {
      const codes = { LICENSE_EXPIRED: 403, MAX_DEVICES_REACHED: 403, LICENSE_SUSPENDED: 403, LICENSE_INACTIVE: 403, DEVICE_BOUND_TO_ANOTHER_LICENSE: 409 };
      return res.status(codes[result.reason] || 400).json({ success: false, code: result.reason, message: result.reason, ...result });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * Validate license online (periodic) - returns server time + signed payload.
 */
router.post('/validate', async (req, res, next) => {
  try {
    const { licenseId, deviceId } = req.body;
    if (!licenseId) return res.status(400).json({ success: false, message: 'licenseId is required' });
    const result = await licenseService.validateOnline(licenseId, deviceId);
    if (!result.valid) {
      const codes = { LICENSE_EXPIRED: 403, LICENSE_SUSPENDED: 403, LICENSE_INACTIVE: 403, DEVICE_NOT_BOUND: 403, DEVICE_BLOCKED: 403, LICENSE_NOT_FOUND: 404 };
      return res.status(codes[result.reason] || 400).json({ success: false, code: result.reason, ...result });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * Fetch the current signed license for a given license id.
 */
router.get('/current', async (req, res, next) => {
  try {
    const { licenseId } = req.query;
    if (!licenseId) return res.status(400).json({ success: false, message: 'licenseId is required' });
    const license = await licenseService.findLicenseById(licenseId);
    if (!license) return res.status(404).json({ success: false, code: 'LICENSE_NOT_FOUND', message: 'License not found' });
    res.json({
      success: true,
      data: {
        payload: licenseService.buildSignedPayload(license),
        signature: license.signature,
        publicKeyId: license.publicKeyId,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
