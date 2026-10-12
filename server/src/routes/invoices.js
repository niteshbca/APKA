const express = require('express');
const Invoice = require('../models/Invoice');
const Sale = require('../models/Sale');
const Setting = require('../models/Setting');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', async (req, res, next) => {
  try {
    const { from, to, search, paymentMode, page = 1, limit = 20 } = req.query;
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    if (paymentMode) query.paymentMode = paymentMode;
    if (search) {
      query.$or = [
        { invoiceNo: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerMobile: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Invoice.countDocuments(query);
    const data = await Invoice.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

router.get('/sale/:saleId', async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ sale: req.params.saleId });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found for this sale' });
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

router.get('/business/current', async (req, res, next) => {
  try {
    let settings = await Setting.findOne({ key: 'business' });
    if (!settings) settings = await Setting.create({ key: 'business' });
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
