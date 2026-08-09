const express = require('express');
const { getDashboard } = require('../services/statsService');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', async (req, res, next) => {
  try {
    const data = await getDashboard(req.query.date ? new Date(req.query.date) : new Date());
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
