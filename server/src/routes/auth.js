const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    const user = await User.findOne({ username: String(username).toLowerCase() }).select('+passwordHash');
    if (!user || !user.active) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or inactive account' });
    }
    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role, branch: user.branch, permissions: user.permissions },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ success: true, token, user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).populate('branch', 'name code isActive settings');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', verifyToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.userId).select('+passwordHash');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, Number(process.env.BCRYPT_ROUNDS) || 10);
    await user.save();
    res.json({ success: true, message: 'Password changed' });
  } catch (err) {
    next(err);
  }
});

router.post('/login-pin', async (req, res, next) => {
  try {
    const { pin, branchId } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN is required' });
    }
    let query = { pin: { $exists: true, $ne: null }, active: true };
    if (branchId) query.branch = branchId;
    
    const users = await User.find(query).select('+pin');
    let matchedUser = null;
    for (const user of users) {
      if (await bcrypt.compare(pin, user.pin)) {
        matchedUser = user;
        break;
      }
    }
    
    if (!matchedUser) {
      return res.status(401).json({ success: false, message: 'Invalid PIN' });
    }
    
    matchedUser.lastLogin = new Date();
    await matchedUser.save();
    
    const token = jwt.sign(
      { sub: matchedUser._id.toString(), role: matchedUser.role, branch: matchedUser.branch, permissions: matchedUser.permissions },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ success: true, token, user: matchedUser.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
