const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const LabelTemplate = require('../models/LabelTemplate');
const LabelPrintLog = require('../models/LabelPrintLog');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');
const { classifyBarcode } = require('../utils/barcode');

const router = express.Router();

const PAPER_PRESETS = [
  { preset: '50x25', label: '50 x 25 mm', widthMm: 50, heightMm: 25, columns: 1 },
  { preset: '50x30', label: '50 x 30 mm', widthMm: 50, heightMm: 30, columns: 1 },
  { preset: '40x30', label: '40 x 30 mm', widthMm: 40, heightMm: 30, columns: 1 },
  { preset: '60x40', label: '60 x 40 mm', widthMm: 60, heightMm: 40, columns: 1 },
  { preset: 'a4-sheet', label: 'A4 sheet (3 x 8)', widthMm: 64, heightMm: 34, columns: 3 },
];

function requiresPrices(req) {
  return req.userRole === 'superadmin' || req.isPlatformAdmin || req.userPermissions.includes('*') || req.userPermissions.includes('labels.prices');
}

function labelProductDTO(p, includePrices) {
  const bc = classifyBarcode(p.barcode);
  const dto = {
    _id: p._id,
    clientId: p.clientId || '',
    name: p.name,
    sku: p.sku,
    barcode: p.barcode || '',
    barcodeFormat: bc.format,
    barcodeValidEan: bc.validEan,
    category: p.category,
    categoryName: p.categoryName || (p.category && p.category.name) || '',
    image: p.image || '',
    unit: p.unit || 'PCS',
    brandName: p.brandName || '',
    variant: p.variant || '',
    size: p.size || '',
    color: p.color || '',
    batchNo: p.batchNo || '',
    lotNumber: p.lotNumber || '',
    manufacturingDate: p.manufacturingDate,
    expiryDate: p.expiryDate,
    stock: p.stock,
    minStock: p.minStock,
    active: p.active,
    gstRate: p.gstRate,
  };
  if (includePrices) {
    dto.mrp = p.mrp;
    dto.sellingPrice = p.sellingPrice;
    dto.offerPrice = p.offerPrice;
    dto.purchasePrice = p.purchasePrice;
  }
  return dto;
}

router.use(verifyToken);
router.use(requireModule('labels'));

router.get('/presets', requirePermission('labels.view'), (req, res) => {
  res.json({ success: true, data: PAPER_PRESETS });
});

// ---------------------------------- Templates ----------------------------------
router.get('/templates', requirePermission('labels.view'), async (req, res, next) => {
  try {
    const templates = await LabelTemplate.find().sort({ isDefault: -1, name: 1 });
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

router.post('/templates', requirePermission('labels.template'), async (req, res, next) => {
  try {
    const { name, description, preset, size, columns, gapXMm, gapYMm, marginMm, showBorder, barcodeType, showQr, showLogo, fields, isDefault } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Template name is required' });
    if (!size || !size.widthMm || !size.heightMm) {
      return res.status(400).json({ success: false, message: 'Label size (widthMm, heightMm) is required' });
    }
    if (isDefault) {
      await LabelTemplate.updateMany({ isDefault: true }, { isDefault: false });
    }
    const template = await LabelTemplate.create({
      name,
      description: description || '',
      preset: preset || 'custom',
      size: { widthMm: Number(size.widthMm), heightMm: Number(size.heightMm) },
      columns: columns || 1,
      gapXMm,
      gapYMm,
      marginMm,
      showBorder,
      barcodeType,
      showQr,
      showLogo,
      fields: Array.isArray(fields) ? fields : [],
      isDefault: !!isDefault,
      createdBy: req.userId,
    });
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

router.put('/templates/:id', requirePermission('labels.template'), async (req, res, next) => {
  try {
    const template = await LabelTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    const fields = ['name', 'description', 'preset', 'columns', 'gapXMm', 'gapYMm', 'marginMm', 'showBorder', 'barcodeType', 'showQr', 'showLogo'];
    for (const f of fields) {
      if (req.body[f] !== undefined) template[f] = req.body[f];
    }
    if (req.body.size) {
      template.size = {
        widthMm: Number(req.body.size.widthMm ?? template.size.widthMm),
        heightMm: Number(req.body.size.heightMm ?? template.size.heightMm),
      };
    }
    if (Array.isArray(req.body.fields)) template.fields = req.body.fields;
    if (req.body.isDefault === true) {
      await LabelTemplate.updateMany({ _id: { $ne: template._id }, isDefault: true }, { isDefault: false });
      template.isDefault = true;
    } else if (req.body.isDefault === false) {
      template.isDefault = false;
    }
    await template.save();
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
});

router.delete('/templates/:id', requirePermission('labels.template'), async (req, res, next) => {
  try {
    const template = await LabelTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    if (template.isDefault) {
      const count = await LabelTemplate.countDocuments();
      if (count > 1) return res.status(400).json({ success: false, message: 'Cannot delete the default template while others exist' });
    }
    await LabelTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
});

// ------------------------------ Product selection ------------------------------
router.get('/products', requirePermission('labels.view'), async (req, res, next) => {
  try {
    const { search, category, ids, active, page = 1, limit = 100 } = req.query;
    const query = {};
    if (req.userRole !== 'superadmin' && !req.isPlatformAdmin && req.userBranch) query.branch = req.userBranch;
    if (category) query.category = category;
    if (active !== undefined) query.active = active === 'true' || active === '1';
    if (ids) {
      const list = String(ids).split(',').filter((x) => mongoose.Types.ObjectId.isValid(x));
      query._id = { $in: list };
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('category', 'name');
    const inc = requiresPrices(req);
    res.json({ success: true, data: products.map((p) => labelProductDTO(p, inc)), total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

/**
 * Resolve a scanned code to a product WITHOUT changing inventory. Used by POS
 * barcode-first checkout and the label module's lookup tool. Tenant- and
 * branch-scoped. Supports barcode, SKU and clientId resolution.
 */
router.get('/lookup/:code', requirePermission('labels.view', 'sales.create'), async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });
    const query = { $or: [{ barcode: code }, { sku: code }, { clientId: code }] };
    if (req.userRole !== 'superadmin' && !req.isPlatformAdmin && req.userBranch) query.branch = req.userBranch;
    const product = await Product.findOne(query).populate('category', 'name');
    if (!product) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'No product matches this code' });
    res.json({ success: true, data: labelProductDTO(product, requiresPrices(req)) });
  } catch (err) {
    next(err);
  }
});

// -------------------------------- Print history --------------------------------
router.get('/logs', requirePermission('labels.view'), async (req, res, next) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const total = await LabelPrintLog.countDocuments({});
    const data = await LabelPrintLog.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

router.post('/logs', requirePermission('labels.print'), async (req, res, next) => {
  try {
    const { template, templateName, mode, reprint, items, meta } = req.body;
    const safeItems = Array.isArray(items)
      ? items.slice(0, 2000).map((i) => ({
          product: mongoose.Types.ObjectId.isValid(i.product) ? i.product : undefined,
          productClientId: i.productClientId || '',
          name: i.name || '',
          sku: i.sku || '',
          barcode: i.barcode || '',
          qty: Number(i.qty) || 0,
        }))
      : [];
    const labelCount = safeItems.reduce((a, i) => a + (i.qty || 0), 0);
    const log = await LabelPrintLog.create({
      template: mongoose.Types.ObjectId.isValid(template) ? template : undefined,
      templateName: templateName || '',
      mode: mode || 'selection',
      reprint: !!reprint,
      itemCount: safeItems.length,
      labelCount,
      items: safeItems,
      user: req.userId,
      userName: req.userDoc ? req.userDoc.name : '',
      branch: req.userBranch || undefined,
      meta: meta || {},
    });
    res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
