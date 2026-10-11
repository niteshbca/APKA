const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Tombstone = require('../models/Tombstone');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { genClientId } = require('../utils/id');

const router = express.Router();

router.use(verifyToken);

router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 100, branch } = req.query;
    const query = {};
    if (req.userRole !== 'superadmin') {
      if (req.userBranch) query.branch = req.userBranch;
    } else if (branch) {
      query.branch = branch;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { gstNumber: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await Customer.countDocuments(query);
    const data = await Customer.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, mobile, email, address, gstNumber } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Customer name is required' });
    const customer = await Customer.create({ clientId: genClientId('cust'), name, mobile, email, address, gstNumber });
    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: { ...req.body, syncedFromCloud: false } },
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const sales = await Sale.find({ customer: req.params.id }).sort({ createdAt: -1 }).limit(50);
    const customer = await Customer.findById(req.params.id);
    res.json({ success: true, data: { customer, sales } });
  } catch (err) {
    next(err);
  }
});

/**
 * Delete a customer by server _id OR clientId, with a tombstone so all other
 * devices remove the same record on next pull (offline delete -> online).
 */
router.delete('/:id', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    let customer = null;
    if (mongoose.Types.ObjectId.isValid(id)) customer = await Customer.findById(id);
    if (!customer) customer = await Customer.findOne({ clientId: id });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    if (customer.clientId) {
      await Tombstone.updateOne(
        { collection: 'Customer', clientId: customer.clientId },
        { $setOnInsert: { deletedAt: new Date() } },
        { upsert: true }
      );
    }
    await Customer.findByIdAndDelete(customer._id);
    res.json({ success: true, message: 'Customer deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
