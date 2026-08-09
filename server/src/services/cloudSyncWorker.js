const Product = require('../models/Product');
const Category = require('../models/Category');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const StockTransaction = require('../models/StockTransaction');
const Setting = require('../models/Setting');
const Tombstone = require('../models/Tombstone');
const Counter = require('../models/Counter');
const CloudSyncState = require('../models/CloudSyncState');
const { genClientId } = require('../utils/id');

const BASE_URL = (process.env.CLOUD_SYNC_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.CLOUD_SYNC_TOKEN || '';
const INTERVAL_MS = Math.max(5000, parseInt(process.env.CLOUD_SYNC_INTERVAL || '30000', 10) || 30000);

let timer = null;
let running = false;

function isEnabled() {
  return !!(BASE_URL && TOKEN);
}

async function getState() {
  return CloudSyncState.findOneAndUpdate(
    { key: 'state' },
    { $setOnInsert: { key: 'state', deviceId: genClientId('dev') } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function api(path, body) {
  const res = await fetch(BASE_URL + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || `Cloud sync request failed (HTTP ${res.status})`);
  }
  return json;
}

/**
 * Backfill stable clientIds / cross-device refs for records created before
 * cloud sync existed.
 */
async function backfillIds() {
  const missing = { $or: [{ clientId: { $exists: false } }, { clientId: null }] };
  const cats = await Category.find(missing);
  for (const c of cats) {
    c.clientId = genClientId('cat');
    await c.save({ timestamps: false });
  }
  const custs = await Customer.find(missing);
  for (const c of custs) {
    c.clientId = genClientId('cust');
    await c.save({ timestamps: false });
  }
  const prods = await Product.find().lean();
  const catMap = new Map((await Category.find().lean()).map((c) => [String(c._id), c.clientId]));
  for (const p of prods) {
    const set = {};
    if (!p.clientId) set.clientId = genClientId('prod');
    if (p.category && !p.categoryClientId) {
      const catId = catMap.get(String(p.category));
      if (catId) set.categoryClientId = catId;
    }
    if (Object.keys(set).length) {
      await Product.updateOne({ _id: p._id }, { $set: set }, { timestamps: false });
    }
  }
  const prodMap = new Map(prods.map((p) => [String(p._id), p.clientId]));
  const missingRef = { $or: [{ productClientId: { $exists: false } }, { productClientId: null }] };
  const purs = await Purchase.find(missingRef);
  for (const p of purs) {
    const cid = prodMap.get(String(p.product));
    if (cid) {
      p.productClientId = cid;
      await p.save({ timestamps: false });
    }
  }
  const txns = await StockTransaction.find(missingRef);
  for (const t of txns) {
    const cid = prodMap.get(String(t.product));
    if (cid) {
      t.productClientId = cid;
      await t.save({ timestamps: false });
    }
  }
}

async function collectPush(lastPushAt) {
  const q = { syncedFromCloud: { $ne: true } };
  if (lastPushAt) q.updatedAt = { $gt: new Date(lastPushAt) };

  const [categories, customers, products, purchases, adjustments] = await Promise.all([
    Category.find(q).lean(),
    Customer.find(q).lean(),
    Product.find(q).lean(),
    Purchase.find(q).lean(),
    StockTransaction.find({ ...q, type: 'adjustment' }).lean(),
  ]);

  const salesQ = { syncSource: { $ne: 'cloud' } };
  if (lastPushAt) salesQ.createdAt = { $gt: new Date(lastPushAt) };
  const sales = await Sale.find(salesQ).lean();

  const tombstones = await Tombstone.find(lastPushAt ? { deletedAt: { $gt: new Date(lastPushAt) } } : {}).lean();

  let settings = await Setting.find().lean();
  if (settings.length) {
    settings = [settings[0]];
    if (lastPushAt && settings[0].updatedAt && new Date(settings[0].updatedAt) <= new Date(lastPushAt)) {
      settings = [];
    }
  } else {
    settings = [];
  }

  return {
    categories,
    customers,
    products,
    purchases,
    stockTransactions: adjustments,
    sales,
    settings,
    tombstones,
  };
}

function mapProduct(p) {
  return {
    clientId: p.clientId,
    categoryClientId: p.categoryClientId || '',
    name: p.name,
    sku: p.sku,
    barcode: p.barcode || '',
    categoryName: p.categoryName || '',
    purchasePrice: p.purchasePrice,
    sellingPrice: p.sellingPrice,
    gstRate: p.gstRate,
    stock: p.stock,
    minStock: p.minStock,
    active: p.active !== undefined ? p.active : true,
    updatedAt: p.updatedAt,
  };
}

function mapSale(s) {
  return {
    clientSaleId: s.clientSaleId,
    invoiceNo: s.invoiceNo,
    customerClientId: s.customerClientId || '',
    customerName: (s.customerSnapshot && s.customerSnapshot.name) || '',
    customerMobile: (s.customerSnapshot && s.customerSnapshot.mobile) || '',
    customerGst: (s.customerSnapshot && s.customerSnapshot.gstNumber) || '',
    customerAddress: (s.customerSnapshot && s.customerSnapshot.address) || '',
    items: (s.items || []).map((it, idx) => ({
      product: it.product,
      productClientId: it.productClientId || '',
      name: it.name,
      sku: it.sku,
      barcode: it.barcode,
      qty: it.qty,
      price: it.price,
      purchasePrice: it.purchasePrice,
      gstRate: it.gstRate,
      lineDiscount: it.lineDiscount,
      clientIndex: idx,
    })),
    discount: s.discount,
    paymentMode: s.paymentMode,
    amountReceived: s.amountReceived,
    changeDue: s.changeDue,
    cashierName: s.cashierName,
    deviceId: s.deviceId,
    createdAt: s.createdAt,
  };
}

function maxUpdatedAt(docs) {
  let max = null;
  for (const d of docs) {
    const t = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
    if (t > max) max = t;
  }
  return max;
}

/**
 * Replace LOC-/collided offline invoice numbers with the cloud-assigned ones.
 */
async function applyInvoiceReplacements(results, localSales) {
  const byClient = new Map(localSales.map((s) => [s.clientSaleId, s]));
  for (const [clientSaleId, r] of Object.entries(results.sales || {})) {
    if (!r.invoiceNo) continue;
    const local = byClient.get(clientSaleId);
    if (!local || local.invoiceNo === r.invoiceNo) continue;
    await Sale.updateOne({ clientSaleId }, { $set: { invoiceNo: r.invoiceNo } }, { timestamps: false });
    await Invoice.updateOne({ clientSaleId }, { $set: { invoiceNo: r.invoiceNo } }, { timestamps: false });
  }
}

async function push() {
  const state = await getState();
  await backfillIds();
  const payload = await collectPush(state.lastPushAt);

  const maxT =
    Math.max(
      maxUpdatedAt(payload.categories),
      maxUpdatedAt(payload.customers),
      maxUpdatedAt(payload.products),
      maxUpdatedAt(payload.purchases),
      maxUpdatedAt(payload.stockTransactions),
      maxUpdatedAt(payload.settings),
      maxUpdatedAt(payload.sales),
      maxUpdatedAt(payload.tombstones.map((t) => ({ updatedAt: t.deletedAt })))
    ) || (state.lastPushAt ? new Date(state.lastPushAt).getTime() : 0);

  if (!payload.categories.length && !payload.customers.length && !payload.products.length && !payload.purchases.length &&
      !payload.stockTransactions.length && !payload.sales.length && !payload.settings.length && !payload.tombstones.length) {
    return { pushed: 0 };
  }

  const json = await api('/api/cloud/sync/push', {
    deviceId: state.deviceId,
    collections: {
      categories: payload.categories,
      customers: payload.customers,
      products: payload.products.map(mapProduct),
      purchases: payload.purchases,
      sales: payload.sales.map(mapSale),
      stockTransactions: payload.stockTransactions,
      settings: payload.settings,
    },
    tombstones: payload.tombstones,
  });

  await applyInvoiceReplacements(json.data.results, payload.sales);

  if (json.data.serverTime) {
    await CloudSyncState.updateOne({ key: 'state' }, { $set: { lastPushAt: new Date(Math.max(maxT, state.lastPushAt ? new Date(state.lastPushAt).getTime() : 0)) } });
  }
  return { pushed: payload.categories.length + payload.customers.length + payload.products.length + payload.purchases.length + payload.stockTransactions.length + payload.sales.length + payload.settings.length + payload.tombstones.length };
}

/**
 * Apply tombstones (deletes) that happened on the cloud to this device.
 */
async function applyLocalTombstone(t) {
  const models = { Product, Category, Customer };
  const M = models[t.collection];
  if (!M || !t.clientId) return;
  await M.deleteOne({ clientId: t.clientId });
}

async function upsertLocalCategory(doc) {
  if (!doc.clientId) return;
  const existing = await Category.findOne({ clientId: doc.clientId });
  if (existing && doc.updatedAt && existing.updatedAt && new Date(doc.updatedAt) <= new Date(existing.updatedAt)) return;
  const fields = {
    name: doc.name,
    slug: doc.slug,
    description: doc.description !== undefined ? doc.description : undefined,
    syncedFromCloud: true,
  };
  if (existing) {
    await Category.updateOne({ _id: existing._id }, { $set: fields, $setOnInsert: { createdAt: new Date(doc.createdAt || Date.now()) } }, { timestamps: false });
  } else {
    try {
      await Category.create({ clientId: doc.clientId, ...fields, createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
}

async function upsertLocalCustomer(doc) {
  if (!doc.clientId) return;
  const existing = await Customer.findOne({ clientId: doc.clientId });
  if (existing && doc.updatedAt && existing.updatedAt && new Date(doc.updatedAt) <= new Date(existing.updatedAt)) return;
  const fields = {
    name: doc.name,
    mobile: doc.mobile,
    email: doc.email,
    address: doc.address,
    gstNumber: doc.gstNumber,
    totalPurchases: doc.totalPurchases,
    lastPurchaseAt: doc.lastPurchaseAt ? new Date(doc.lastPurchaseAt) : undefined,
    syncedFromCloud: true,
  };
  if (existing) {
    await Customer.updateOne({ _id: existing._id }, { $set: fields }, { timestamps: false });
  } else {
    try {
      await Customer.create({ clientId: doc.clientId, ...fields, createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
}

async function upsertLocalProduct(doc) {
  if (!doc.clientId) return;
  const existing = await Product.findOne({ clientId: doc.clientId });
  if (existing && doc.updatedAt && existing.updatedAt && new Date(doc.updatedAt) <= new Date(existing.updatedAt)) return;
  let categoryId = null;
  if (doc.categoryClientId) {
    const cat = await Category.findOne({ clientId: doc.categoryClientId });
    categoryId = cat ? cat._id : null;
  }
  const stock = doc.stock !== undefined ? doc.stock : 0;
  const minStock = doc.minStock !== undefined ? doc.minStock : 5;
  const fields = {
    categoryClientId: doc.categoryClientId || '',
    category: categoryId,
    categoryName: doc.categoryName || '',
    name: doc.name,
    sku: doc.sku,
    barcode: doc.barcode || undefined,
    purchasePrice: doc.purchasePrice || 0,
    sellingPrice: doc.sellingPrice ?? 0,
    gstRate: doc.gstRate || 0,
    stock,
    minStock,
    active: doc.active !== undefined ? doc.active : true,
    isLowStock: stock <= minStock,
    syncedFromCloud: true,
  };
  if (existing) {
    await Product.updateOne({ _id: existing._id }, { $set: fields }, { timestamps: false });
  } else {
    try {
      await Product.create({ clientId: doc.clientId, ...fields, createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
}

async function upsertLocalPurchase(doc) {
  if (!doc.clientId) return;
  const existing = await Purchase.findOne({ clientId: doc.clientId });
  if (existing) return;
  const prod = doc.productClientId ? await Product.findOne({ clientId: doc.productClientId }) : null;
  if (!prod) return;
  try {
    await Purchase.create({
      clientId: doc.clientId,
      productClientId: doc.productClientId,
      product: prod._id,
      name: doc.name || prod.name,
      sku: doc.sku || prod.sku,
      supplierName: doc.supplierName || '',
      type: doc.type || 'purchase',
      qty: doc.qty,
      costPrice: doc.costPrice || 0,
      total: (doc.costPrice || 0) * doc.qty,
      note: doc.note || '',
      userName: doc.userName || 'system',
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      syncedFromCloud: true,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

async function upsertLocalStockTxn(doc) {
  if (!doc.clientId) return;
  const existing = await StockTransaction.findOne({ clientId: doc.clientId });
  if (existing) return;
  const prod = doc.productClientId ? await Product.findOne({ clientId: doc.productClientId }) : null;
  if (!prod) return;
  try {
    await StockTransaction.create({
      clientId: doc.clientId,
      productClientId: doc.productClientId,
      product: prod._id,
      name: doc.name || prod.name,
      sku: doc.sku || prod.sku,
      type: doc.type,
      qty: doc.qty,
      previousStock: doc.previousStock,
      newStock: doc.newStock,
      reference: doc.reference || '',
      note: doc.note || '',
      userName: doc.userName || 'system',
      deviceId: doc.deviceId || '',
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      syncedFromCloud: true,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

async function upsertLocalSale(doc) {
  if (!doc.clientSaleId) return;
  const existing = await Sale.findOne({ clientSaleId: doc.clientSaleId });
  if (existing) {
    await Sale.updateOne(
      { _id: existing._id },
      {
        $set: {
          invoiceNo: doc.invoiceNo,
          customerClientId: doc.customerClientId || existing.customerClientId,
          customerSnapshot: doc.customerSnapshot || existing.customerSnapshot,
          items: doc.items || existing.items,
          subtotal: doc.subtotal,
          discount: doc.discount,
          taxable: doc.taxable,
          gstTotal: doc.gstTotal,
          total: doc.total,
          paymentMode: doc.paymentMode,
          amountReceived: doc.amountReceived,
          changeDue: doc.changeDue,
          cashierName: doc.cashierName,
          syncedAt: doc.syncedAt || existing.syncedAt,
        },
      },
      { timestamps: false }
    );
    return;
  }
  try {
    await Sale.create({
      clientSaleId: doc.clientSaleId,
      clientDeviceId: doc.clientDeviceId,
      customerClientId: doc.customerClientId || undefined,
      invoiceNo: doc.invoiceNo,
      customerSnapshot: doc.customerSnapshot,
      items: doc.items || [],
      subtotal: doc.subtotal,
      discount: doc.discount,
      taxable: doc.taxable,
      gstTotal: doc.gstTotal,
      total: doc.total,
      paymentMode: doc.paymentMode,
      amountReceived: doc.amountReceived,
      changeDue: doc.changeDue,
      cashierName: doc.cashierName,
      deviceId: doc.deviceId,
      syncSource: 'cloud',
      syncedAt: doc.syncedAt || doc.createdAt,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

async function upsertLocalInvoice(doc) {
  if (!doc.clientSaleId) return;
  const existing = await Invoice.findOne({ clientSaleId: doc.clientSaleId });
  const fields = {
    invoiceNo: doc.invoiceNo,
    businessName: doc.businessName,
    businessAddress: doc.businessAddress,
    businessGstin: doc.businessGstin,
    businessPhone: doc.businessPhone,
    customerName: doc.customerName,
    customerMobile: doc.customerMobile,
    customerGst: doc.customerGst,
    customerAddress: doc.customerAddress,
    items: doc.items,
    subtotal: doc.subtotal,
    discount: doc.discount,
    taxable: doc.taxable,
    gstTotal: doc.gstTotal,
    total: doc.total,
    paymentMode: doc.paymentMode,
    amountReceived: doc.amountReceived,
    changeDue: doc.changeDue,
    cashierName: doc.cashierName,
    deviceId: doc.deviceId,
  };
  if (existing) {
    await Invoice.updateOne({ _id: existing._id }, { $set: fields }, { timestamps: false });
  } else {
    try {
      await Invoice.create({
        clientSaleId: doc.clientSaleId,
        sale: doc.sale,
        ...fields,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
}

async function upsertLocalSettings(docs) {
  const doc = docs && docs[0];
  if (!doc || !doc.key) return;
  let existing = await Setting.findOne({ key: 'business' });
  if (existing && doc.updatedAt && existing.updatedAt && new Date(doc.updatedAt) <= new Date(existing.updatedAt)) return;
  const fields = {
    businessName: doc.businessName,
    address: doc.address,
    phone: doc.phone,
    gstin: doc.gstin,
    logoUrl: doc.logoUrl,
    footerNote: doc.footerNote,
    thermalWidth: doc.thermalWidth,
    currency: doc.currency,
    invoicePrefix: doc.invoicePrefix,
  };
  if (existing) {
    await Setting.updateOne({ _id: existing._id }, { $set: fields }, { timestamps: false });
  } else {
    await Setting.create({ key: 'business', ...fields });
  }
}

async function syncCounters(invoices) {
  for (const inv of invoices || []) {
    const m = /^([A-Z0-9]+)-(\d{8})-(\d{4})$/.exec(inv.invoiceNo || '');
    if (!m) continue;
    const name = `${m[1]}-${m[2]}`;
    const seq = parseInt(m[3], 10);
    await Counter.updateOne(
      { name },
      { $max: { seq }, $setOnInsert: { name } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
}

async function pull() {
  const state = await getState();
  const json = await api('/api/cloud/sync/pull' + (state.lastPullAt ? `?since=${encodeURIComponent(new Date(state.lastPullAt).toISOString())}` : ''));
  const data = json.data || {};

  for (const t of data.tombstones || []) await applyLocalTombstone(t);
  for (const doc of data.categories || []) await upsertLocalCategory(doc);
  for (const doc of data.customers || []) await upsertLocalCustomer(doc);
  for (const doc of data.products || []) await upsertLocalProduct(doc);
  for (const doc of data.purchases || []) await upsertLocalPurchase(doc);
  for (const doc of data.stockTransactions || []) await upsertLocalStockTxn(doc);
  for (const doc of data.sales || []) await upsertLocalSale(doc);
  for (const doc of data.invoices || []) await upsertLocalInvoice(doc);
  await upsertLocalSettings(data.settings || []);
  await syncCounters(data.invoices || []);

  if (data.serverTime) {
    await CloudSyncState.updateOne({ key: 'state' }, { $set: { lastPullAt: new Date(data.serverTime) } });
  }
  return {
    pulled: (data.categories || []).length + (data.customers || []).length + (data.products || []).length +
            (data.purchases || []).length + (data.stockTransactions || []).length + (data.sales || []).length +
            (data.invoices || []).length,
  };
}

/**
 * Runs one full push -> pull cycle. Safe to call concurrently (guarded).
 */
async function runOnce() {
  if (!isEnabled()) return { enabled: false };
  if (running) return { alreadyRunning: true };
  running = true;
  const startedAt = Date.now();
  try {
    await CloudSyncState.updateOne({ key: 'state' }, { $set: { syncing: true, lastError: '' } });
    const pushed = await push();
    const pulled = await pull();
    await CloudSyncState.updateOne(
      { key: 'state' },
      {
        $set: {
          syncing: false,
          online: true,
          lastSuccessAt: new Date(),
          lastSyncDurationMs: Date.now() - startedAt,
        },
      }
    );
    return { enabled: true, online: true, ...pushed, ...pulled };
  } catch (err) {
    await CloudSyncState.updateOne(
      { key: 'state' },
      { $set: { syncing: false, online: false, lastError: String((err && err.message) || err).slice(0, 500) } }
    );
    throw err;
  } finally {
    running = false;
  }
}

async function tick() {
  try {
    await runOnce();
  } catch (err) {
    console.error('[cloud-sync]', err.message);
  }
}

function start() {
  if (!isEnabled()) return false;
  if (timer) return true;
  tick();
  timer = setInterval(tick, INTERVAL_MS);
  if (timer.unref) timer.unref();
  return true;
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { isEnabled, start, stop, runOnce, getState };
