const express = require('express');
const Setting = require('../models/Setting');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', async (req, res, next) => {
  try {
    let settings = await Setting.findOne({ key: 'business' });
    if (!settings) settings = await Setting.create({ key: 'business' });
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

router.put('/', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const allowed = ['businessName', 'address', 'phone', 'gstin', 'logoUrl', 'footerNote', 'thermalWidth', 'currency', 'invoicePrefix'];
    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    const settings = await Setting.findOneAndUpdate({ key: 'business' }, { $set: update }, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
