const Product = require('../models/Product');
const Category = require('../models/Category');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const StockTransaction = require('../models/StockTransaction');
const Setting = require('../models/Setting');
const Tombstone = require('../models/Tombstone');
const syncService = require('./syncService');
const { adjustStock } = require('./stockService');
const { genClientId } = require('../utils/id');

const SETTING_FIELDS = [
  'businessName',
  'address',
  'phone',
  'gstin',
  'logoUrl',
  'footerNote',
  'thermalWidth',
  'currency',
  'invoicePrefix',
];

function isNewerThan(doc, existing) {
  if (!doc.updatedAt || !existing || !existing.updatedAt) return true;
  return new Date(doc.updatedAt).getTime() > new Date(existing.updatedAt).getTime();
}

/**
 * The cloud hub is a "merge" point. Master data (categories/customers/products)
 * is merged by stable clientId using last-writer-wins on updatedAt. The `stock`
 * field on products is only applied on first creation (opening balance); after
 * that stock is derived purely from sales / purchases / stock-adjustment
 * operations, so multiple devices never double-deduct.
 */

async function upsertCategory(doc) {
  const clientId = doc.clientId || genClientId('cat');
  let existing = await Category.findOne({ clientId });
  if (existing) {
    if (!isNewerThan(doc, existing)) return existing;
    existing.name = doc.name || existing.name;
    if (doc.slug) existing.slug = doc.slug;
    if (doc.description !== undefined) existing.description = doc.description;
    await existing.save();
    return existing;
  }
  try {
    return await Category.create({ clientId, name: doc.name, slug: doc.slug, description: doc.description });
  } catch (err) {
    if (err.code === 11000) {
      const byName = await Category.findOne({ name: doc.name });
      if (byName) {
        if (!byName.clientId) {
          byName.clientId = clientId;
          await byName.save();
        }
        return byName;
      }
    }
    throw err;
  }
}

async function upsertCustomer(doc) {
  const clientId = doc.clientId || genClientId('cust');
  let existing = await Customer.findOne({ clientId });
  if (existing) {
    if (!isNewerThan(doc, existing)) return existing;
    existing.name = doc.name || existing.name;
    if (doc.mobile !== undefined) existing.mobile = doc.mobile;
    if (doc.email !== undefined) existing.email = doc.email;
    if (doc.address !== undefined) existing.address = doc.address;
    if (doc.gstNumber !== undefined) existing.gstNumber = doc.gstNumber;
    if (doc.totalPurchases !== undefined) existing.totalPurchases = doc.totalPurchases;
    if (doc.lastPurchaseAt) existing.lastPurchaseAt = new Date(doc.lastPurchaseAt);
    await existing.save();
    return existing;
  }
  try {
    return await Customer.create({
      clientId,
      name: doc.name,
      mobile: doc.mobile,
      email: doc.email,
      address: doc.address,
      gstNumber: doc.gstNumber,
      totalPurchases: doc.totalPurchases || 0,
      lastPurchaseAt: doc.lastPurchaseAt ? new Date(doc.lastPurchaseAt) : undefined,
    });
  } catch (err) {
    if (err.code === 11000) {
      const byMobile = doc.mobile ? await Customer.findOne({ mobile: doc.mobile }) : null;
      if (byMobile) {
        if (!byMobile.clientId) {
          byMobile.clientId = clientId;
          await byMobile.save();
        }
        return byMobile;
      }
    }
    throw err;
  }
}

async function upsertProduct(doc) {
  const clientId = doc.clientId || genClientId('prod');
  let existing = await Product.findOne({ clientId });
  const categoryClientId = doc.categoryClientId || '';
  let categoryId = null;
  if (categoryClientId) {
    const cat = await Category.findOne({ clientId: categoryClientId });
    categoryId = cat ? cat._id : null;
  }

  if (existing) {
    if (!isNewerThan(doc, existing)) return existing;
    existing.name = doc.name || existing.name;
    existing.sku = doc.sku || existing.sku;
    if (doc.barcode !== undefined) existing.barcode = doc.barcode;
    existing.category = categoryId || existing.category;
    existing.categoryClientId = categoryClientId || existing.categoryClientId;
    if (doc.categoryName !== undefined) existing.categoryName = doc.categoryName;
    if (doc.purchasePrice !== undefined) existing.purchasePrice = doc.purchasePrice;
    if (doc.sellingPrice !== undefined) existing.sellingPrice = doc.sellingPrice;
    if (doc.gstRate !== undefined) existing.gstRate = doc.gstRate;
    if (doc.minStock !== undefined) existing.minStock = doc.minStock;
    if (doc.active !== undefined) existing.active = doc.active;
    // NOTE: stock intentionally NOT updated here — derived from operations.
    await existing.save();
    return existing;
  }

  try {
    const created = await Product.create({
      clientId,
      categoryClientId: categoryClientId || undefined,
      category: categoryId,
      categoryName: doc.categoryName || '',
      name: doc.name,
      sku: doc.sku,
      barcode: doc.barcode || undefined,
      purchasePrice: doc.purchasePrice || 0,
      sellingPrice: doc.sellingPrice ?? 0,
      gstRate: doc.gstRate || 0,
      stock: doc.stock || 0,
      minStock: doc.minStock ?? 5,
      active: doc.active !== undefined ? doc.active : true,
    });
    created.isLowStock = created.stock <= created.minStock;
    await created.save();
    if ((doc.stock || 0) > 0) {
      await StockTransaction.create({
        clientId: `product-opening-${clientId}`,
        productClientId: clientId,
        product: created._id,
        name: created.name,
        sku: created.sku,
        type: 'opening',
        qty: created.stock,
        previousStock: 0,
        newStock: created.stock,
        reference: 'OPENING',
        note: 'Opening stock',
      });
    }
    return created;
  } catch (err) {
    if (err.code === 11000) {
      const bySku = await Product.findOne({ sku: doc.sku });
      if (bySku) {
        if (!bySku.clientId) {
          bySku.clientId = clientId;
          await bySku.save();
        }
        return bySku;
      }
    }
    throw err;
  }
}

async function upsertPurchase(doc) {
  const clientId = doc.clientId || genClientId('pur');
  const existing = await Purchase.findOne({ clientId });
  if (existing) return existing;
  const prod = doc.productClientId ? await Product.findOne({ clientId: doc.productClientId }) : null;
  if (!prod) throw new Error(`Product not found for purchase (clientId: ${clientId})`);
  const purchase = await Purchase.create({
    clientId,
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
  });
  await adjustStock(prod, purchase.qty, purchase.type === 'opening' ? 'opening' : 'purchase', {
    reference: purchase._id.toString(),
    note: purchase.note,
    userName: purchase.userName,
    deviceId: doc.deviceId || '',
    clientId: `purchase-${purchase.clientId}`,
    productClientId: purchase.productClientId,
  });
  return purchase;
}

async function applyAdjustment(doc) {
  const clientId = doc.clientId || genClientId('adjust');
  const existing = await StockTransaction.findOne({ clientId });
  if (existing) return existing;
  const prod = doc.productClientId ? await Product.findOne({ clientId: doc.productClientId }) : null;
  if (!prod) throw new Error(`Product not found for adjustment (clientId: ${clientId})`);
  await adjustStock(prod, doc.qty, 'adjustment', {
    reference: doc.reference || 'MANUAL',
    note: doc.note || 'Manual adjustment',
    userName: doc.userName || 'system',
    deviceId: doc.deviceId || '',
    clientId,
    productClientId: doc.productClientId,
  });
  return StockTransaction.findOne({ clientId });
}

async function processSale(doc) {
  if (!doc.clientSaleId) doc.clientSaleId = genClientId('sale');
  return syncService.createSaleFromPayload(doc, { deviceId: doc.deviceId || 'cloud' });
}

async function upsertSettings(doc) {
  if (!doc || typeof doc !== 'object') return null;
  let existing = await Setting.findOne({ key: 'business' });
  if (existing) {
    if (!isNewerThan(doc, existing)) return existing;
    for (const f of SETTING_FIELDS) {
      if (doc[f] !== undefined) existing[f] = doc[f];
    }
    await existing.save();
    return existing;
  }
  const body = { key: 'business' };
  for (const f of SETTING_FIELDS) if (doc[f] !== undefined) body[f] = doc[f];
  return Setting.create(body);
}

async function applyTombstone(t) {
  if (!t || !t.clientId) return;
  const models = { Product, Category, Customer };
  const M = models[t.collection];
  if (!M) return;
  await M.deleteOne({ clientId: t.clientId });
  await Tombstone.updateOne(
    { collection: t.collection, clientId: t.clientId },
    { $setOnInsert: { deletedAt: t.deletedAt ? new Date(t.deletedAt) : new Date() } },
    { upsert: true }
  );
}

/**
 * Processes a full device push. Idempotent — safe to re-send.
 */
async function handlePush(payload) {
  const results = { sales: {}, purchases: {}, adjustments: {}, errors: [] };
  const run = async (label, list, fn) => {
    for (const doc of list || []) {
      try {
        await fn(doc);
      } catch (err) {
        results.errors.push({ type: label, clientId: doc && doc.clientId, message: err.message });
      }
    }
  };

  await run('tombstone', payload.tombstones, (t) => applyTombstone(t));
  await run('category', payload.categories, (d) => upsertCategory(d));
  await run('customer', payload.customers, (d) => upsertCustomer(d));
  await run('product', payload.products, (d) => upsertProduct(d));
  await run('purchase', payload.purchases, async (d) => {
    await upsertPurchase(d);
    results.purchases[d.clientId] = 'ok';
  });
  await run('adjustment', payload.stockTransactions, async (d) => {
    await applyAdjustment(d);
    results.adjustments[d.clientId] = 'ok';
  });
  await run('sale', payload.sales, async (d) => {
    const r = await processSale(d);
    results.sales[d.clientSaleId] = { status: r.status, invoiceNo: r.invoiceNo, saleId: r.saleId };
  });
  await run('settings', payload.settings, (d) => upsertSettings(d));

  return results;
}

/**
 * Returns everything changed on the hub since `since` (ISO timestamp).
 */
async function handlePull(since) {
  const sinceDate = since ? new Date(since) : null;
  const qUpdated = sinceDate ? { updatedAt: { $gt: sinceDate } } : {};
  const qCreated = sinceDate ? { createdAt: { $gt: sinceDate } } : {};
  const qTombstone = sinceDate ? { deletedAt: { $gt: sinceDate } } : {};

  const [categories, customers, products, purchases, stockTransactions, sales, invoices, tombstones, settings] =
    await Promise.all([
      Category.find(qUpdated).lean(),
      Customer.find(qUpdated).lean(),
      Product.find(qUpdated).lean(),
      Purchase.find(qUpdated).lean(),
      StockTransaction.find(qUpdated).lean(),
      Sale.find(qCreated).lean(),
      Invoice.find(qCreated).lean(),
      Tombstone.find(qTombstone).lean(),
      Setting.find().lean(),
    ]);

  return {
    serverTime: new Date().toISOString(),
    categories,
    customers,
    products,
    purchases,
    stockTransactions,
    sales,
    invoices,
    settings,
    tombstones: tombstones.map((t) => ({ collection: t.collection, clientId: t.clientId, deletedAt: t.deletedAt })),
  };
}

module.exports = { handlePush, handlePull };
