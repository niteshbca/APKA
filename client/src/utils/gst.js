/**
 * Computes cart totals exactly like the server (invoiceService.computeTotals).
 * item = { qty, price, gstRate, lineDiscount }
 */
export function computeTotals(items, orderDiscount = 0) {
  let subtotal = 0;
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

  const gstBuckets = {};
  for (const it of normalized) {
    const rate = it.gstRate;
    const base = ((it.price * it.qty - it.lineDiscount) / (subtotal || 1)) * taxable;
    gstBuckets[rate] = (gstBuckets[rate] || 0) + Math.round(base * (rate / 100) * 100) / 100;
  }
  const gstTotal = Object.values(gstBuckets).reduce((a, b) => a + b, 0);

  return {
    items: normalized,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    taxable: Math.round(taxable * 100) / 100,
    gstTotal: Math.round(gstTotal * 100) / 100,
    gstBuckets,
    total: Math.round((taxable + gstTotal) * 100) / 100,
  };
}

export function lineTotal(line) {
  const qty = Number(line.qty) || 0;
  const price = Number(line.price) || 0;
  const lineDiscount = Number(line.lineDiscount) || 0;
  const gstRate = Number(line.gstRate) || 0;
  const discounted = Math.max(0, qty * price - lineDiscount);
  const gstAmount = Math.round(discounted * (gstRate / 100) * 100) / 100;
  return Math.round((discounted + gstAmount) * 100) / 100;
}
