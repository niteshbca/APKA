const express = require('express');
const Device = require('../models/Device');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/me', async (req, res, next) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) return res.json({ success: true, data: null });
    const device = await Device.findOne({ deviceId });
    res.json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
