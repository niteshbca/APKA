const express = require('express');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const StockTransaction = require('../models/StockTransaction');
const { adjustStock } = require('../services/stockService');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');
const { genClientId } = require('../utils/id');
const audit = require('../services/auditService');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('operations'));

const view = requirePermission('operations.view', 'settings.view');
const manage = requirePermission('operations.manage', 'settings.edit', 'inventory.adjust');

router.get('/transfers', view, async (req, res, next) => {
  try {
    const data = await StockTransaction.find({ reference: /TRANSFER/ }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/transfer', manage, async (req, res, next) => {
  try {
    const { product, toBranch, qty, note } = req.body;
    const quantity = Number(qty);
    if (!product || !toBranch || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'product, toBranch and a positive qty are required' });
    }
    const source = await Product.findById(product);
    if (!source) return res.status(404).json({ success: false, message: 'Product not found' });
    if ((source.stock || 0) < quantity) {
      return res.status(400).json({ success: false, message: `Only ${source.stock} units available in source branch` });
    }
    const target = await Branch.findById(toBranch);
    const targetName = target ? target.name : 'target branch';

    await adjustStock(source, -quantity, 'adjustment', {
      reference: 'TRANSFER-OUT',
      note: note || `Transfer to ${targetName}`,
      user: req.userId,
      userName: req.userDoc ? req.userDoc.name : 'admin',
      clientId: `transfer-out-${genClientId()}`,
      productClientId: source.clientId || undefined,
    });

    // If the same SKU exists in the destination branch, add the stock there.
    let received = false;
    const destProduct = await Product.findOne({ sku: source.sku, branch: toBranch });
    if (destProduct) {
      await adjustStock(destProduct, quantity, 'adjustment', {
        reference: 'TRANSFER-IN',
        note: note || `Transfer from ${source.branch || 'source'}`,
        user: req.userId,
        userName: req.userDoc ? req.userDoc.name : 'admin',
        clientId: `transfer-in-${genClientId()}`,
        productClientId: destProduct.clientId || undefined,
      });
      received = true;
    }

    audit.record(req, { action: 'operations.transfer', entity: 'stock', entityId: source._id, meta: { qty: quantity, toBranch, received } });
    res.json({ success: true, data: { transferred: quantity, product: source.name, targetBranch: targetName, received } });
  } catch (err) { next(err); }
});

router.get('/summary', view, async (req, res, next) => {
  try {
    const [transfers, branches, lowStock] = await Promise.all([
      StockTransaction.countDocuments({ reference: /TRANSFER/ }),
      Branch.countDocuments({ active: { $ne: false } }),
      Product.countDocuments({ $expr: { $lte: ['$stock', '$minStock'] } }),
    ]);
    res.json({ success: true, data: { transfers, branches, lowStock } });
  } catch (err) { next(err); }
});

module.exports = router;
