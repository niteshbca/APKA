const express = require('express');
const notificationService = require('../services/notificationService');
const Device = require('../models/Device');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('integrations'));

const view = requirePermission('integrations.view', 'settings.view');

router.get('/status', view, async (req, res, next) => {
  try {
    const branchId = req.userBranch;
    const settings = branchId ? await notificationService.getSettings(branchId) : null;
    const devices = await Device.countDocuments({}).catch(() => 0);
    res.json({
      success: true,
      data: {
        api: {
          base: '/api',
          healthy: true,
          serverTime: new Date().toISOString(),
        },
        email: {
          enabled: !!(settings && settings.email && settings.email.enabled),
          provider: settings && settings.email ? settings.email.provider || 'smtp' : 'smtp',
          host: settings && settings.email ? settings.email.host : '',
          from: settings && settings.email ? settings.email.fromEmail : '',
        },
        whatsapp: {
          enabled: !!(settings && settings.whatsapp && settings.whatsapp.enabled),
          provider: settings && settings.whatsapp ? settings.whatsapp.provider : '',
        },
        cloudSync: {
          enabled: !!(process.env.CLOUD_SYNC_URL && process.env.CLOUD_SYNC_TOKEN),
        },
        devices,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
