const Counter = require('../models/Counter');

/**
 * Generates sequential invoice numbers like INV-20260806-0001.
 * @param {Date} [date]
 * @param {string} [prefix] e.g. 'INV'
 */
async function nextInvoiceNo(date = new Date(), prefix = process.env.INVOICE_PREFIX || 'INV') {
  const ymd =
    `${date.getFullYear()}` +
    `${String(date.getMonth() + 1).padStart(2, '0')}` +
    `${String(date.getDate()).padStart(2, '0')}`;
  const doc = await Counter.findOneAndUpdate(
    { name: `${prefix}-${ymd}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `${prefix}-${ymd}-${String(doc.seq).padStart(4, '0')}`;
}

/**
 * Compute invoice totals from cart line items.
 * item = { qty, price, gstRate, lineDiscount }
 */
function computeTotals(items, orderDiscount = 0) {
  let subtotal = 0;
  const gstBuckets = {};

  const normalized = items.map((it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    const lineDiscount = Number(it.lineDiscount) || 0;
    const gross = qty * price;
    const discounted = Math.max(0, gross - lineDiscount);
    const gstRate = Number(it.gstRate) || 0;
    const gstAmount = Math.round(discounted * (gstRate / 100) * 100) / 100;
    subtotal += gross;
    return { ...it, qty, price, lineDiscount, gstRate, gstAmount, lineTotal: discounted + gstAmount };
  });

  const discount = Math.min(orderDiscount || 0, subtotal);
  const taxable = Math.max(0, subtotal - discount);

  for (const it of normalized) {
    const rate = it.gstRate;
    const base = (it.price * it.qty - it.lineDiscount) / (subtotal || 1) * taxable;
    gstBuckets[rate] = (gstBuckets[rate] || 0) + (Math.round(base * (rate / 100) * 100) / 100);
  }
  let gstTotal = Object.values(gstBuckets).reduce((a, b) => a + b, 0);
  gstTotal = Math.round(gstTotal * 100) / 100;

  const total = Math.round((taxable + gstTotal) * 100) / 100;

  return {
    items: normalized,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    taxable: Math.round(taxable * 100) / 100,
    gstTotal,
    gstBuckets,
    total,
  };
}

module.exports = { nextInvoiceNo, computeTotals };
