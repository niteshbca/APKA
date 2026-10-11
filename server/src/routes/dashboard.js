const express = require('express');
const { getDashboard } = require('../services/statsService');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', async (req, res, next) => {
  try {
    let branchId = req.query.branch || null;
    // Non-superadmin users are always scoped to their own branch.
    if (req.userRole !== 'superadmin' && req.userBranch) {
      branchId = req.userBranch;
    }
    const data = await getDashboard(req.query.date ? new Date(req.query.date) : new Date(), branchId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;