import db from './index';
import { uid, shortDeviceId } from '../utils/format';
import { computeTotals } from '../utils/gst';

/* ------------------------------ product lookup ----------------------------- */

export async function getAllProducts() {
  return db.getAll('products');
}

export async function searchProductsLocal(query, { category, includeInactive = true } = {}) {
  const all = await getAllProducts();
  const q = String(query || '').trim().toLowerCase();
  return all.filter((p) => {
    if (!includeInactive && !p.active) return false;
    if (category && p.category !== category && p.categoryName !== category) return false;
    if (!q) return true;
    return (
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.barcode || '').toLowerCase().includes(q)
    );
  });
}

export function findProductByBarcodeLocal(products, barcode) {
  return products.find((p) => p.barcode && String(p.barcode) === String(barcode).trim());
}

/* ------------------------------- stock local ------------------------------ */

export async function adjustStockLocal(product, delta, { note = '', reference = '' } = {}) {
  const existing = await db.get('products', product.sku);
  if (!existing) return null;
  const previousStock = existing.stock || 0;
  const newStock = Math.max(0, previousStock + delta);
  const updated = { ...existing, stock: newStock, isLowStock: newStock <= (existing.minStock || 0) };
  await db.put('products', updated);
  await db.put('stockTransactions', {
    id: uid('STX'),
    product: existing._id || existing.sku,
    name: existing.name,
    sku: existing.sku,
    type: delta > 0 ? 'purchase' : 'sale',
    qty: delta,
    previousStock,
    newStock,
    reference,
    note,
    createdAt: new Date().toISOString(),
  });
  return updated;
}

/* ------------------------------ invoice counter --------------------------- */

export async function nextLocalInvoiceNo(deviceId) {
  const key = `inv-${new Date().toISOString().slice(0, 10)}`;
  const counter = await db.get('counters', key);
  const seq = (counter?.seq || 0) + 1;
  await db.put('counters', { key, seq });
  return `LOC-${shortDeviceId(deviceId)}-${String(seq).padStart(4, '0')}`;
}

/* ------------------------------ offline sale ------------------------------ */

/**
 * Saves a sale fully offline: records the sale + invoice snapshot, deducts
 * local stock and queues the operation for later sync.
 */
export async function saveSaleOffline({ items, discount, customer, paymentMode, amountReceived, changeDue, cashierName, deviceId, businessName, branch }) {
  const totals = computeTotals(items, discount);

  const clientSaleId = uid('SALE');
  const invoiceNo = await nextLocalInvoiceNo(deviceId);
  const createdAt = new Date().toISOString();

  const sale = {
    clientSaleId,
    invoiceNo,
    items: await Promise.all(
      totals.items.map(async (i) => {
        const local = i.sku ? await db.get('products', i.sku) : null;
        return {
          product: i.product,
          productClientId: i.productClientId || local?.clientId || undefined,
          name: i.name,
          sku: i.sku,
          barcode: i.barcode,
          qty: i.qty,
          price: i.price,
          purchasePrice: i.purchasePrice || 0,
          gstRate: i.gstRate,
          gstAmount: i.gstAmount,
          lineDiscount: i.lineDiscount,
          total: i.lineTotal,
        };
      })
    ),
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    gstTotal: totals.gstTotal,
    total: totals.total,
    customer: customer?.id || null,
    customerName: customer?.name || '',
    customerMobile: customer?.mobile || '',
    customerEmail: customer?.email || '',
    customerGst: customer?.gstNumber || '',
    customerAddress: customer?.address || '',
    paymentMode,
    amountReceived: amountReceived || 0,
    changeDue: changeDue || 0,
    cashierName,
    deviceId,
    branch,
    createdAt,
    synced: false,
    serverInvoiceNo: null,
  };

  const invoice = {
    invoiceNo,
    clientSaleId,
    saleId: clientSaleId,
    businessName,
    customerName: customer?.name || 'Walk-in Customer',
    customerMobile: customer?.mobile || '',
    customerEmail: customer?.email || '',
    customerGst: customer?.gstNumber || '',
    customerAddress: customer?.address || '',
    items: totals.items.map((i) => ({
      name: i.name,
      sku: i.sku,
      barcode: i.barcode,
      qty: i.qty,
      price: i.price,
      gstRate: i.gstRate,
      gstAmount: i.gstAmount,
      lineDiscount: i.lineDiscount,
      total: i.lineTotal,
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    gstTotal: totals.gstTotal,
    total: totals.total,
    paymentMode,
    amountReceived: amountReceived || 0,
    changeDue: changeDue || 0,
    cashierName,
    deviceId,
    createdAt,
  };

  await db.put('sales', sale);
  await db.put('invoices', invoice);

  for (const it of totals.items) {
    await adjustStockLocal(
      { sku: it.sku, ...it },
      -it.qty,
      { note: `Sale ${invoiceNo}`, reference: invoiceNo }
    );
  }

  await queueOperation('sale', {
    clientSaleId,
    invoiceNo,
    items: sale.items,
    discount,
    subtotal: totals.subtotal,
    taxable: totals.taxable,
    gstTotal: totals.gstTotal,
    total: totals.total,
    customerName: customer?.name || '',
    customerMobile: customer?.mobile || '',
    customerEmail: customer?.email || '',
    customerGst: customer?.gstNumber || '',
    customerAddress: customer?.address || '',
    paymentMode,
    amountReceived: amountReceived || 0,
    changeDue: changeDue || 0,
    cashierName,
    deviceId,
    branch,
    createdAt,
  });

  return { sale, invoice, totals };
}

/* ------------------------------ sync outbox ------------------------------- */

export async function queueOperation(opType, payload) {
  const clientOpId = uid('OP');
  await db.put('outbox', { clientOpId, opType, payload, status: 'pending', attempts: 0, createdAt: new Date().toISOString() });
  return clientOpId;
}

export async function getPendingOps() {
  const all = await db.getAll('outbox');
  return all
    .filter((o) => o.status === 'pending')
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

/**
 * Returns operations to push next: pending ones plus failed ones that are
 * still retryable (so a temporary server error doesn't leave "N pending sync"
 * forever — it retries automatically on the next sync cycle).
 */
export async function getRetryableOps() {
  const all = await db.getAll('outbox');
  return all
    .filter((o) => {
      if (o.status === 'pending') return true;
      return o.status === 'failed' && (o.attempts || 0) < 8;
    })
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export async function markOpDone(clientOpId, result) {
  const op = await db.get('outbox', clientOpId);
  if (op) await db.put('outbox', { ...op, status: 'done', result, syncedAt: new Date().toISOString() });
}

export async function markOpFailed(clientOpId, error) {
  const op = await db.get('outbox', clientOpId);
  if (op) await db.put('outbox', { ...op, status: 'failed', error, attempts: (op.attempts || 0) + 1, lastAttemptAt: new Date().toISOString() });
}

export async function resetFailedOps() {
  const all = await db.getAll('outbox');
  for (const op of all) {
    if (op.status === 'failed') await db.put('outbox', { ...op, status: 'pending' });
  }
}

/**
 * Marks every pending op referencing the given clientId as superseded.
 * Used when a locally-created (not yet synced) record is deleted or edited,
 * so stale create/update ops are never pushed afterwards.
 */
export async function supersedePendingOps(clientId) {
  if (!clientId) return;
  const all = await db.getAll('outbox');
  for (const op of all) {
    const matches =
      op.status === 'pending' &&
      op.payload &&
      (op.payload.clientId === clientId || op.payload.clientSaleId === clientId);
    if (matches) {
      await db.put('outbox', { ...op, status: 'superseded', supersededAt: new Date().toISOString() });
    }
  }
}

export async function countPendingOps() {
  const all = await db.getAll('outbox');
  return all.filter((o) => o.status === 'pending' || o.status === 'failed').length;
}

/* --------------------------- local sync state ----------------------------- */

export async function getLastSyncAt() {
  const s = await db.get('syncState', 'lastSyncAt');
  return s ? s.value : null;
}

export async function setLastSyncAt(iso) {
  await db.put('syncState', { key: 'lastSyncAt', value: iso });
}

/* --------------------------- apply pulled data ---------------------------- */

function mapId(value) {
  if (!value) return value;
  if (typeof value !== 'object') return value;
  return value._id || value.$oid || value;
}

export async function applyPull(data) {
  const now = new Date().toISOString();

  if (Array.isArray(data.products)) {
    const products = data.products.map((p) => ({
      ...p,
      _id: p._id,
      category: mapId(p.category),
      categoryName: p.categoryName || '',
      updatedAt: p.updatedAt || now,
    }));
    await db.putMany('products', products);
  }

  if (Array.isArray(data.categories)) {
    for (const c of data.categories) {
      if (c.clientId) {
        const all = await db.getAll('categories');
        const dup = all.find((x) => x.clientId === c.clientId && x.id !== c._id);
        if (dup) await db.delete('categories', dup.id);
      }
    }
    await db.putMany('categories', data.categories.map((c) => ({ ...c, id: c._id, name: c.name, description: c.description })));
  }

  if (Array.isArray(data.customers)) {
    for (const c of data.customers) {
      if (c.clientId) {
        const all = await db.getAll('customers');
        const dup = all.find((x) => x.clientId === c.clientId && x.id !== c._id);
        if (dup) await db.delete('customers', dup.id);
      }
    }
    await db.putMany('customers', data.customers.map((c) => ({ ...c, id: c._id })));
  }

  // Merged server-created sales/invoices (e.g. other devices) become read-only copies.
  if (Array.isArray(data.sales)) {
    for (const s of data.sales) {
      const existing = s.clientSaleId ? await db.get('sales', s.clientSaleId) : null;
      await db.put('sales', {
        clientSaleId: s.clientSaleId || `server-${s._id}`,
        _id: s._id,
        invoiceNo: s.invoiceNo,
        serverInvoiceNo: s.invoiceNo,
        synced: true,
        serverId: s._id,
        items: s.items,
        subtotal: s.subtotal,
        discount: s.discount,
        taxable: s.taxable,
        gstTotal: s.gstTotal,
        total: s.total,
        customerName: s.customerSnapshot?.name || '',
        customerMobile: s.customerSnapshot?.mobile || '',
        customerEmail: s.customerSnapshot?.email || '',
        customerGst: s.customerSnapshot?.gstNumber || '',
        paymentMode: s.paymentMode,
        amountReceived: s.amountReceived,
        changeDue: s.changeDue,
        cashierName: s.cashierName,
        deviceId: s.deviceId,
        createdAt: s.createdAt,
        local: existing ? true : false,
      });
    }
  }

  if (Array.isArray(data.invoices)) {
    const mapped = data.invoices.map((inv) => ({
      invoiceNo: inv.invoiceNo,
      clientSaleId: inv.clientSaleId || `server-${inv._id}`,
      businessName: inv.businessName,
      customerName: inv.customerName,
      customerMobile: inv.customerMobile,
      customerGst: inv.customerGst,
      customerAddress: inv.customerAddress,
      items: inv.items,
      subtotal: inv.subtotal,
      discount: inv.discount,
      taxable: inv.taxable,
      gstTotal: inv.gstTotal,
      total: inv.total,
      paymentMode: inv.paymentMode,
      amountReceived: inv.amountReceived,
      changeDue: inv.changeDue,
      cashierName: inv.cashierName,
      deviceId: inv.deviceId,
      createdAt: inv.createdAt,
    }));
    await db.putMany('invoices', mapped);
  }

  if (Array.isArray(data.purchases)) {
    const mapped = data.purchases.map((p) => ({
      ...p,
      id: p._id,
      product: mapId(p.product),
    }));
    await db.putMany('purchases', mapped);
  }

  if (Array.isArray(data.tombstones) && data.tombstones.length) {
    await applyTombstones(data.tombstones);
  }

  return true;
}

/**
 * Applies delete-tombstones from the server so records deleted on any device
 * (or online) are removed from this device's offline database too.
 */
export async function applyTombstones(tombstones) {
  for (const t of tombstones) {
    if (t.collection === 'Product') {
      const all = await db.getAll('products');
      const match = all.find((p) => (p.clientId && p.clientId === t.clientId) || p._id === t.clientId);
      if (match) await db.delete('products', match.sku);
    } else if (t.collection === 'Category') {
      const all = await db.getAll('categories');
      const match = all.find((c) => (c.clientId && c.clientId === t.clientId) || c.id === t.clientId || c._id === t.clientId);
      if (match) await db.delete('categories', match.id || match._id);
    } else if (t.collection === 'Customer') {
      const all = await db.getAll('customers');
      const match = all.find((c) => (c.clientId && c.clientId === t.clientId) || c.id === t.clientId || c._id === t.clientId);
      if (match) await db.delete('customers', match.id || match._id);
    } else if (t.collection === 'Sale') {
      const all = await db.getAll('sales');
      const match = all.find(
        (s) =>
          s.clientSaleId === t.clientId ||
          s.serverId === t.clientId ||
          s._id === t.clientId ||
          `sale-${s.serverId || s._id || ''}` === t.clientId ||
          s.invoiceNo === t.clientId
      );
      if (match) {
        await db.delete('sales', match.clientSaleId);
        if (match.invoiceNo) await db.delete('invoices', match.invoiceNo);
      } else {
        // Sale record missing locally — still drop any matching invoice.
        const invoices = await db.getAll('invoices');
        const inv = invoices.find(
          (i) =>
            i.invoiceNo === t.clientId ||
            i.clientSaleId === t.clientId ||
            `server-${t.clientId.replace(/^sale-/, '')}` === i.clientSaleId
        );
        if (inv) await db.delete('invoices', inv.invoiceNo);
      }
    }
  }
}
