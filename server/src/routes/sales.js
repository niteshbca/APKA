const express = require('express');
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Invoice = require('../models/Invoice');
const Tombstone = require('../models/Tombstone');
const { createSaleFromPayload, refreshLowStock } = require('../services/syncService');
const { verifyToken } = require('../middleware/auth');
const { licenseGuard } = require('../middleware/license');

const router = express.Router();

router.use(verifyToken);

router.get('/', async (req, res, next) => {
  try {
    const { from, to, paymentMode, cashier, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    if (paymentMode) query.paymentMode = paymentMode;
    if (cashier) query.cashier = cashier;
    if (search) query.invoiceNo = { $regex: search, $options: 'i' };

    const total = await Sale.countDocuments(query);
    const data = await Sale.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('customer', 'name mobile');
    res.json({ success: true, data, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id).populate('customer', 'name mobile gstNumber address');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, data: sale });
  } catch (err) {
    next(err);
  }
});

/**
 * Create a sale while ONLINE. Backed by the same idempotent service used by
 * offline sync so behaviour is identical.
 */
router.post('/', licenseGuard, async (req, res, next) => {
  try {
    const payload = req.body;
    payload.syncSource = 'online';
    payload.cashierName = payload.cashierName || 'system';
    const result = await createSaleFromPayload(payload, { deviceId: payload.deviceId || 'online' });
    if (result.status === 'error') {
      return res.status(400).json({ success: false, message: result.message });
    }
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * Delete a sale (and its invoice) by server _id OR clientSaleId. Creates a
 * tombstone so every other device removes the same record on next pull.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let sale = null;
    if (mongoose.Types.ObjectId.isValid(id)) sale = await Sale.findById(id);
    if (!sale) sale = await Sale.findOne({ clientSaleId: id });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });

    const tombKey = sale.clientSaleId || `sale-${sale._id}`;
    await Tombstone.updateOne(
      { collection: 'Sale', clientId: tombKey },
      { $setOnInsert: { deletedAt: new Date() } },
      { upsert: true }
    );
    await Invoice.deleteOne({ clientSaleId: sale.clientSaleId });
    await Invoice.deleteOne({ sale: sale._id });
    await Sale.findByIdAndDelete(sale._id);
    res.json({ success: true, message: 'Sale deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
