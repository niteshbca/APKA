const express = require('express');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const { adjustStock } = require('../services/stockService');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { licenseGuard } = require('../middleware/license');
const { genClientId } = require('../utils/id');

const router = express.Router();

router.use(verifyToken, licenseGuard);

router.get('/', requireRoles('superadmin', 'admin', 'cashier'), async (req, res, next) => {
  try {
    const { from, to, product, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    if (product) query.product = product;
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { supplierName: { $regex: search, $options: 'i' } }];
    const total = await Purchase.countDocuments(query);
    const data = await Purchase.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const { product, supplierName, qty, costPrice, note, type = 'purchase' } = req.body;
    if (!product || !qty || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Product and positive quantity required' });
    }
    const prod = await Product.findById(product);
    if (!prod) return res.status(404).json({ success: false, message: 'Product not found' });

    const purchaseId = genClientId('pur');
    const purchase = await Purchase.create({
      clientId: purchaseId,
      productClientId: prod.clientId || undefined,
      product: prod._id,
      name: prod.name,
      sku: prod.sku,
      supplierName,
      type,
      qty,
      costPrice: costPrice || 0,
      total: (costPrice || 0) * qty,
      note,
      user: req.userId,
    });

    await adjustStock(prod, qty, type === 'opening' ? 'opening' : 'purchase', {
      reference: purchase._id.toString(),
      note,
      user: req.userId,
      userName: req.body.userName || 'admin',
      clientId: `purchase-${purchaseId}`,
      productClientId: prod.clientId || undefined,
    });

    res.status(201).json({ success: true, data: purchase });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found' });
    await Purchase.findByIdAndDelete(purchase._id);
    res.json({ success: true, data: purchase });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
