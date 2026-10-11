const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function getDashboard(now = new Date(), branchId = null) {
  const start = startOfDay(now);
  const end = endOfDay(now);

  const branchFilter = branchId ? { branch: branchId } : {};
  const productFilter = branchId ? { branch: branchId } : {};
  const customerFilter = branchId ? { branch: branchId } : {};

  const [todaySales, allSales, productCount, lowStock, customers] = await Promise.all([
    Sale.find({ ...branchFilter, createdAt: { $gte: start, $lte: end } }).lean(),
    Sale.find({ ...branchFilter }).lean(),
    Product.countDocuments(productFilter),
    Product.find({ ...productFilter, $expr: { $lte: ['$stock', '$minStock'] } }).select('name sku stock minStock').lean(),
    Customer.countDocuments(customerFilter),
  ]);

  const summarize = (list) => {
    let sales = 0;
    let invoices = 0;
    let profit = 0;
    let cash = 0;
    let upi = 0;
    let card = 0;
    let qty = 0;
    for (const s of list) {
      sales += s.total;
      invoices += 1;
      let cost = 0;
      for (const i of s.items) {
        cost += (i.purchasePrice || 0) * i.qty;
        qty += i.qty;
      }
      profit += s.total - s.discount - cost;
      if (s.paymentMode === 'cash') cash += s.total;
      else if (s.paymentMode === 'upi') upi += s.total;
      else if (s.paymentMode === 'card') card += s.total;
    }
    return {
      sales: Math.round(sales * 100) / 100,
      invoices,
      profit: Math.round(profit * 100) / 100,
      cash: Math.round(cash * 100) / 100,
      upi: Math.round(upi * 100) / 100,
      card: Math.round(card * 100) / 100,
      qty,
    };
  };

  // Build 7-day sales trend
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStart = startOfDay(d);
    const dayEnd = endOfDay(d);
    const daySales = allSales.filter((s) => {
      const t = new Date(s.createdAt).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    });
    let total = 0;
    for (const s of daySales) total += s.total;
    trend.push({
      date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      sales: Math.round(total * 100) / 100,
      invoices: daySales.length,
    });
  }

  // Top selling products
  const productMap = {};
  for (const s of allSales) {
    for (const i of s.items) {
      const key = i.sku || i.name;
      if (!productMap[key]) productMap[key] = { name: i.name, sku: i.sku, qty: 0, revenue: 0 };
      productMap[key].qty += i.qty;
      productMap[key].revenue += i.qty * i.price;
    }
  }
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }));

  // Payment mode split
  const paymentSplit = { cash: 0, upi: 0, card: 0 };
  for (const s of allSales) {
    if (paymentSplit[s.paymentMode] !== undefined) paymentSplit[s.paymentMode] += s.total;
  }

  // Branch comparison (only meaningful for superadmin / all branches)
  let branchStats = [];
  if (!branchId) {
    const branches = await Branch.find().select('name code').lean();
    const stats = branches.map((b) => {
      const bSales = allSales.filter((s) => s.branch && s.branch.toString() === b._id.toString());
      let total = 0;
      for (const s of bSales) total += s.total;
      return { _id: b._id, name: b.name, code: b.code, sales: Math.round(total * 100) / 100, invoices: bSales.length };
    });
    branchStats = stats.sort((a, b) => b.sales - a.sales);
  }

  return {
    today: summarize(todaySales),
    totals: summarize(allSales),
    productCount,
    lowStockCount: lowStock.length,
    lowStockProducts: lowStock,
    customerCount: customers,
    trend,
    topProducts,
    paymentSplit,
    branchStats,
  };
}

module.exports = { getDashboard, startOfDay, endOfDay };
