const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

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

async function getDashboard(now = new Date()) {
  const start = startOfDay(now);
  const end = endOfDay(now);

  const [todaySales, allSales, productCount, lowStock, customers] = await Promise.all([
    Sale.find({ createdAt: { $gte: start, $lte: end } }).lean(),
    Sale.find().lean(),
    Product.countDocuments(),
    Product.find({ $expr: { $lte: ['$stock', '$minStock'] } }).select('name sku stock minStock').lean(),
    Customer.countDocuments(),
  ]);

  const summarize = (list) => {
    let sales = 0;
    let invoices = 0;
    let profit = 0;
    let cash = 0;
    let upi = 0;
    let card = 0;
    for (const s of list) {
      sales += s.total;
      invoices += 1;
      let cost = 0;
      for (const i of s.items) cost += (i.purchasePrice || 0) * i.qty;
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
    };
  };

  return {
    today: summarize(todaySales),
    totals: summarize(allSales),
    productCount,
    lowStockCount: lowStock.length,
    lowStockProducts: lowStock,
    customerCount: customers,
  };
}

module.exports = { getDashboard, startOfDay, endOfDay };
