const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const { name, username, email, password, role, active } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: 'name, username and password are required' });
    }
    const exists = await User.findOne({ username: String(username).toLowerCase() });
    if (exists) return res.status(409).json({ success: false, message: 'Username already exists' });
    const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 10);
    const user = await User.create({
      name,
      username,
      email,
      passwordHash,
      role: role === 'superadmin' ? 'cashier' : role || 'cashier',
      active: active !== false,
    });
    res.status(201).json({ success: true, data: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.body.name) user.name = req.body.name;
    if (req.body.email !== undefined) user.email = req.body.email;
    if (req.body.active !== undefined) user.active = !!req.body.active;
    if (req.body.role && req.body.role !== 'superadmin') user.role = req.body.role;
    if (req.body.password && req.body.password.length >= 6) {
      user.passwordHash = await bcrypt.hash(req.body.password, Number(process.env.BCRYPT_ROUNDS) || 10);
    }
    await user.save();
    res.json({ success: true, data: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRoles('superadmin'), async (req, res, next) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
