const express = require('express');
const StockTransaction = require('../models/StockTransaction');
const Product = require('../models/Product');
const { adjustStock } = require('../services/stockService');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { licenseGuard } = require('../middleware/license');
const { genClientId } = require('../utils/id');

const router = express.Router();

router.use(verifyToken, licenseGuard);

router.get('/transactions', async (req, res, next) => {
  try {
    const { from, to, product, type, page = 1, limit = 30 } = req.query;
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    if (product) query.product = product;
    if (type) query.type = type;
    const total = await StockTransaction.countDocuments(query);
    const data = await StockTransaction.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

router.post('/adjust', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const { product, delta, reason } = req.body;
    if (!product || !delta) return res.status(400).json({ success: false, message: 'product and delta required' });
    const prod = await Product.findById(product);
    if (!prod) return res.status(404).json({ success: false, message: 'Product not found' });
    await adjustStock(prod, delta, 'adjustment', {
      reference: 'MANUAL',
      note: reason || 'Manual adjustment',
      user: req.userId,
      userName: req.body.userName || 'admin',
      clientId: `adjust-${genClientId()}`,
      productClientId: prod.clientId || undefined,
    });
    const updated = await Product.findById(product);
    res.json({ success: true, data: updated.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.get('/low-stock', async (req, res, next) => {
  try {
    const data = await Product.find({ $expr: { $lte: ['$stock', '$minStock'] } })
      .sort({ stock: 1 })
      .limit(100);
    res.json({ success: true, data: data.map((p) => p.toSafeJSON()) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
