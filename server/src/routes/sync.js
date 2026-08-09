const express = require('express');
const Device = require('../models/Device');
const syncService = require('../services/syncService');
const { verifyToken } = require('../middleware/auth');
const { licenseGuard } = require('../middleware/license');

const router = express.Router();

router.use(verifyToken, licenseGuard);

/**
 * Register / heartbeat the current device.
 */
router.post('/device', async (req, res, next) => {
  try {
    const { deviceId, name, platform } = req.body;
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId is required' });
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { name: name || 'Unknown', platform: platform || 'web', lastSeenAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
});

/**
 * Push offline operations to the server. Idempotent per clientOpId.
 */
router.post('/push', async (req, res, next) => {
  try {
    const { deviceId, operations = [] } = req.body;
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId is required' });
    if (!Array.isArray(operations) || operations.length === 0) {
      return res.json({ success: true, data: { results: [], serverTime: new Date().toISOString() } });
    }
    await Device.findOneAndUpdate({ deviceId }, { lastSyncAt: new Date() });
    const results = await syncService.processPush(deviceId, operations);
    res.json({ success: true, data: { results, serverTime: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

/**
 * Pull changed master data (products/categories/customers/licenses/invoices).
 */
router.get('/pull', async (req, res, next) => {
  try {
    const { deviceId, since } = req.query;
    const data = await syncService.pullChanges(deviceId, since);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/status', async (req, res, next) => {
  try {
    const { deviceId } = req.query;
    const device = deviceId ? await Device.findOne({ deviceId }) : null;
    res.json({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        device,
        pendingServerOps: 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
