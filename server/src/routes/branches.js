const express = require('express');
const Branch = require('../models/Branch');
const User = require('../models/User');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { genClientId } = require('../utils/id');

const router = express.Router();

router.use(verifyToken);

router.get('/', async (req, res, next) => {
  try {
    const branches = await Branch.find().sort({ isMain: -1, name: 1 });
    res.json({ success: true, data: branches });
  } catch (err) {
    next(err);
  }
});

router.get('/active', async (req, res, next) => {
  try {
    const branches = await Branch.find({ isActive: true }).sort({ isMain: -1, name: 1 });
    res.json({ success: true, data: branches });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });
    res.json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const { name, code, address, phone, email, gstin, settings } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: 'Name and code are required' });
    
    const existing = await Branch.findOne({ code: code.toUpperCase() });
    if (existing) return res.status(409).json({ success: false, message: 'Branch code already exists' });

    const isMain = await Branch.countDocuments() === 0;
    const branch = await Branch.create({
      clientId: genClientId('br'),
      name,
      code: code.toUpperCase(),
      address,
      phone,
      email,
      gstin,
      isMain,
      settings: settings || {},
    });
    res.status(201).json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });

    const fields = ['name', 'code', 'address', 'phone', 'email', 'gstin', 'isActive'];
    for (const f of fields) {
      if (req.body[f] !== undefined) branch[f] = f === 'code' ? req.body[f].toUpperCase() : req.body[f];
    }
    if (req.body.settings) {
      branch.settings = { ...branch.settings, ...req.body.settings };
    }

    if (req.body.isMain && !branch.isMain) {
      await Branch.updateMany({ _id: { $ne: branch._id } }, { isMain: false });
    }

    branch.syncedFromCloud = false;
    await branch.save();
    res.json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRoles('superadmin'), async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });

    const userCount = await User.countDocuments({ branch: branch._id });
    if (userCount > 0) {
      return res.status(400).json({ success: false, message: `Branch has ${userCount} users. Reassign or delete them first.` });
    }

    if (branch.isMain) {
      return res.status(400).json({ success: false, message: 'Cannot delete main branch' });
    }

    await Branch.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Branch deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;