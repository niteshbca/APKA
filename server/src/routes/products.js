const express = require('express');
const Product = require('../models/Product');
const Tombstone = require('../models/Tombstone');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { genClientId } = require('../utils/id');

const router = express.Router();

router.use(verifyToken);

router.get('/', async (req, res, next) => {
  try {
    const { search, category, lowStock, active, page = 1, limit = 100 } = req.query;
    const query = {};
    if (category) query.category = category;
    if (active !== undefined) query.active = active === 'true' || active === '1';
    if (lowStock === 'true' || lowStock === '1') query.$expr = { $lte: ['$stock', '$minStock'] };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('category', 'name');
    res.json({
      success: true,
      data: products.map((p) => ({ ...p.toSafeJSON(), categoryName: p.category ? p.category.name : p.categoryName })),
      total,
      page: Number(page),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const { name, sku, barcode, category, purchasePrice, sellingPrice, gstRate, stock, minStock, image } = req.body;
    if (!name || !sku) return res.status(400).json({ success: false, message: 'name and sku are required' });
    if (await Product.findOne({ sku })) return res.status(409).json({ success: false, message: 'SKU already exists' });
    if (barcode && (await Product.findOne({ barcode }))) return res.status(409).json({ success: false, message: 'Barcode already exists' });
    let categoryClientId = '';
    if (category) {
      const cat = await require('../models/Category').findById(category);
      categoryClientId = cat ? cat.clientId || '' : '';
    }
    const product = await Product.create({
      clientId: genClientId('prod'),
      categoryClientId: categoryClientId || undefined,
      name,
      sku,
      barcode: barcode || undefined,
      category: category || null,
      image: image || undefined,
      purchasePrice: purchasePrice || 0,
      sellingPrice: sellingPrice ?? 0,
      gstRate: gstRate || 0,
      stock: stock || 0,
      minStock: minStock ?? 5,
      isLowStock: (stock || 0) <= (minStock ?? 5),
    });
    res.status(201).json({ success: true, data: product.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (req.body.sku !== undefined) {
      const dupSku = await Product.findOne({ sku: req.body.sku, _id: { $ne: product._id } });
      if (dupSku) return res.status(409).json({ success: false, message: 'SKU already exists' });
    }
    if (req.body.barcode) {
      const dupB = await Product.findOne({ barcode: req.body.barcode, _id: { $ne: product._id } });
      if (dupB) return res.status(409).json({ success: false, message: 'Barcode already exists' });
    }
    const fields = ['name', 'sku', 'barcode', 'category', 'purchasePrice', 'sellingPrice', 'gstRate', 'stock', 'minStock', 'active', 'image'];
    for (const f of fields) {
      if (req.body[f] !== undefined) product[f] = req.body[f];
    }
    if (req.body.category) {
      const cat = await require('../models/Category').findById(req.body.category);
      product.categoryName = cat ? cat.name : '';
      product.categoryClientId = cat ? cat.clientId || '' : '';
    }
    product.isLowStock = product.stock <= product.minStock;
    product.syncedFromCloud = false;
    await product.save();
    res.json({ success: true, data: product.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.clientId) {
      await Tombstone.updateOne(
        { collection: 'Product', clientId: product.clientId },
        { $setOnInsert: { deletedAt: new Date() } },
        { upsert: true }
      );
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
