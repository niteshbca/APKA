const express = require('express');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Tombstone = require('../models/Tombstone');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { genClientId } = require('../utils/id');

const router = express.Router();

router.use(verifyToken);

router.get('/', async (req, res, next) => {
  try {
    const query = {};
    if (req.userRole !== 'superadmin') {
      if (req.userBranch) query.branch = req.userBranch;
    } else if (req.query.branch) {
      query.branch = req.query.branch;
    }
    const categories = await Category.find(query).sort({ name: 1 });
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const { name, description, image } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });
    const category = await Category.create({
      clientId: genClientId('cat'),
      branch: (req.userRole !== 'superadmin' && req.userBranch) ? req.userBranch : (req.body.branch || undefined),
      name,
      description,
      image: image || undefined,
    });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    if (req.body.name) category.name = req.body.name;
    if (req.body.description !== undefined) category.description = req.body.description;
    if (req.body.image !== undefined) category.image = req.body.image;
    category.syncedFromCloud = false;
    await category.save();
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const used = await Product.countDocuments({ category: req.params.id });
    if (used > 0) {
      return res.status(400).json({ success: false, message: `Category has ${used} products. Move or delete them first.` });
    }
    const category = await Category.findById(req.params.id);
    if (category && category.clientId) {
      await Tombstone.updateOne(
        { collection: 'Category', clientId: category.clientId },
        { $setOnInsert: { deletedAt: new Date() } },
        { upsert: true }
      );
    }
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
