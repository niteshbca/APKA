const express = require('express');
const CloudSyncState = require('../models/CloudSyncState');
const cloudHubService = require('../services/cloudHubService');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Hub authentication: accepts the shared CLOUD_SYNC_TOKEN (used by the local
 * sync worker) OR a regular JWT. Cloud endpoints intentionally skip the
 * license guard — devices must be able to sync even while offline.
 */
function cloudSyncAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const secret = process.env.CLOUD_SYNC_TOKEN || '';
  if (secret && token && token === secret) return next();
  return verifyToken(req, res, next);
}

/**
 * Idempotent push from a device. Merges master data by clientId (last-writer
 * wins on updatedAt) and applies sales/purchases/adjustments as operations.
 */
router.post('/sync/push', cloudSyncAuth, async (req, res, next) => {
  try {
    const results = await cloudHubService.handlePush(req.body);
    res.json({ success: true, data: { results, serverTime: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

/**
 * Pull everything changed since `since` (ISO timestamp).
 */
router.get('/sync/pull', cloudSyncAuth, async (req, res, next) => {
  try {
    const data = await cloudHubService.handlePull(req.query.since);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * Local cloud-sync status (for the UI).
 */
router.get('/status', verifyToken, async (req, res, next) => {
  try {
    const state = await CloudSyncState.findOne({ key: 'state' });
    res.json({
      success: true,
      data: {
        enabled: !!(process.env.CLOUD_SYNC_URL && process.env.CLOUD_SYNC_TOKEN),
        url: process.env.CLOUD_SYNC_URL || '',
        state,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Manually trigger one sync cycle (useful for testing / "Sync Now" button).
 */
router.post('/sync-now', verifyToken, async (req, res, next) => {
  try {
    const worker = require('../services/cloudSyncWorker');
    const result = await worker.runOnce();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
