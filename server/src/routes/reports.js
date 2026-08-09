const express = require('express');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const { startOfDay, endOfDay } = require('../services/statsService');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

function range(query) {
  const r = {};
  if (query.from) r.$gte = new Date(query.from);
  if (query.to) r.$lte = new Date(query.to);
  return r;
}

async function aggregateSales(from, to) {
  const match = {};
  if (from || to) match.createdAt = range({ from, to });

  const sales = await Sale.find(match).lean();
  const byKey = new Map();

  const key = (d, groupBy) => {
    const date = new Date(d);
    if (groupBy === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  for (const s of sales) {
    const k = key(s.createdAt, 'day');
    if (!byKey.has(k)) byKey.set(k, { date: k, sales: 0, invoices: 0, profit: 0 });
    const rec = byKey.get(k);
    rec.sales += s.total;
    rec.invoices += 1;
    for (const i of s.items) rec.profit += (i.price - (i.purchasePrice || 0)) * i.qty - (i.lineDiscount || 0);
  }

  return { sales, buckets: Array.from(byKey.values()).map((b) => ({ ...b, sales: Math.round(b.sales * 100) / 100, profit: Math.round(b.profit * 100) / 100 })) };
}

router.get('/sales', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { buckets } = await aggregateSales(from, to);
    res.json({ success: true, data: buckets });
  } catch (err) {
    next(err);
  }
});

router.get('/product-wise', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (from || to) match.createdAt = range({ from, to });
    const sales = await Sale.find(match).lean();
    const map = new Map();
    for (const s of sales) {
      for (const i of s.items) {
        if (!map.has(i.sku)) {
          map.set(i.sku, { sku: i.sku, name: i.name, qty: 0, revenue: 0, cost: 0, profit: 0 });
        }
        const r = map.get(i.sku);
        r.qty += i.qty;
        r.revenue += i.price * i.qty - (i.lineDiscount || 0);
        r.cost += (i.purchasePrice || 0) * i.qty;
        r.profit += (i.price - (i.purchasePrice || 0)) * i.qty - (i.lineDiscount || 0);
      }
    }
    const data = Array.from(map.values()).map((r) => ({
      ...r,
      revenue: Math.round(r.revenue * 100) / 100,
      cost: Math.round(r.cost * 100) / 100,
      profit: Math.round(r.profit * 100) / 100,
    })).sort((a, b) => b.revenue - a.revenue);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/customer-wise', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (from || to) match.createdAt = range({ from, to });
    const sales = await Sale.find(match).lean();
    const map = new Map();
    for (const s of sales) {
      const name = s.customerSnapshot?.name || 'Walk-in';
      if (!map.has(name)) map.set(name, { customer: name, mobile: s.customerSnapshot?.mobile || '', invoices: 0, sales: 0 });
      const r = map.get(name);
      r.invoices += 1;
      r.sales += s.total;
    }
    const data = Array.from(map.values()).map((r) => ({ ...r, sales: Math.round(r.sales * 100) / 100 })).sort((a, b) => b.sales - a.sales);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/payment-wise', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (from || to) match.createdAt = range({ from, to });
    const sales = await Sale.find(match).lean();
    const map = { cash: 0, upi: 0, card: 0 };
    for (const s of sales) {
      if (s.paymentMode in map) map[s.paymentMode] += s.total;
    }
    const data = Object.entries(map).map(([paymentMode, amount]) => ({ paymentMode, amount: Math.round(amount * 100) / 100, count: sales.filter((s) => s.paymentMode === paymentMode).length }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/profit', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { buckets, sales } = await aggregateSales(from, to);
    let revenue = 0;
    let cost = 0;
    for (const s of sales) {
      revenue += s.total;
      for (const i of s.items) cost += (i.purchasePrice || 0) * i.qty;
    }
    res.json({
      success: true,
      data: {
        revenue: Math.round(revenue * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        profit: Math.round((revenue - cost) * 100) / 100,
        invoices: sales.length,
        buckets,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/stock', async (req, res, next) => {
  try {
    const products = await Product.find().sort({ name: 1 }).limit(500);
    const data = products.map((p) => p.toSafeJSON());
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const { from, to, type } = req.query;
    const query = {};
    if (from || to) query.createdAt = range({ from, to });
    if (type) query.type = type;
    const data = await StockTransaction.find(query).sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
