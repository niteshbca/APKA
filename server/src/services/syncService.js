const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const License = require('../models/License');
const Device = require('../models/Device');
const Tombstone = require('../models/Tombstone');
const { nextInvoiceNo, computeTotals } = require('./invoiceService');
const licenseService = require('./licenseService');
const { genClientId } = require('../utils/id');

/**
 * Recompute product isLowStock flags.
 */
async function refreshLowStock() {
  const products = await Product.find();
  for (const p of products) {
    const isLow = p.stock <= p.minStock;
    if (p.isLowStock !== isLow) {
      p.isLowStock = isLow;
      await p.save();
    }
  }
}

/**
 * Applies stock deductions for a sale document (created online or from sync).
 */
async function applySaleStock(sale) {
  const productIds = sale.items
    .map((i) => i.product)
    .filter((p) => p && mongoose.Types.ObjectId.isValid(String(p)));
  const products = await Product.find({ _id: { $in: productIds } });
  const map = new Map(products.map((p) => [String(p._id), p]));

  for (const item of sale.items) {
    const prod = map.get(String(item.product));
    if (!prod) continue;
    const newStock = Math.max(0, prod.stock - item.qty);
    prod.stock = newStock;
    prod.isLowStock = newStock <= prod.minStock;
    await prod.save();
    await require('../models/StockTransaction').create({
      clientId: `sale-${sale.clientSaleId || sale._id}-${item.clientIndex || 0}`,
      productClientId: item.productClientId || prod.clientId || undefined,
      product: prod._id,
      name: prod.name,
      sku: prod.sku,
      type: 'sale',
      qty: -item.qty,
      previousStock: newStock + item.qty,
      newStock,
      reference: sale.invoiceNo,
      userName: sale.cashierName || 'system',
      deviceId: sale.deviceId,
    });
  }
}

/**
 * Processes a sale operation (from online API or from offline sync push).
 * Idempotent via clientSaleId.
 * NOTE: Runs without DB transactions so it works on standalone MongoDB.
 * The unique index on clientSaleId guarantees no duplicate invoices.
 */
async function createSaleFromPayload(payload, { deviceId, cashier = null } = {}) {
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    return { status: 'error', message: 'Sale has no items' };
  }

  // 1. Idempotency check - avoid duplicate invoices during sync
  if (payload.clientSaleId) {
    const existing = await Sale.findOne({ clientSaleId: payload.clientSaleId });
    if (existing) {
      return { status: 'duplicate', invoiceNo: existing.invoiceNo, saleId: existing._id };
    }
  }

  // 2. Build totals
  const totals = computeTotals(payload.items, payload.discount || 0);

  // 2.5 Resolve product refs. Devices send stable productClientIds (for
  //     offline-created products) AND/OR server ObjectIds. Only assign valid
  //     ObjectId refs so the stock/Invoice writes never throw a CastError for
  //     local-only ids (this used to make offline sale sync fail forever).
  const clientIds = totals.items.map((i) => i.productClientId).filter(Boolean);
  const refsByClientId = {};
  if (clientIds.length) {
    const prods = await Product.find({ clientId: { $in: clientIds } });
    for (const p of prods) refsByClientId[p.clientId] = p._id;
  }
  totals.items = totals.items.map((item) => {
    let productRef = null;
    if (item.product && mongoose.Types.ObjectId.isValid(String(item.product))) {
      productRef = item.product;
    } else if (item.productClientId && refsByClientId[item.productClientId]) {
      productRef = refsByClientId[item.productClientId];
    }
    return { ...item, product: productRef };
  });

  // 3. Determine invoice number (regenerate if local offline number collides)
  let invoiceNo = payload.invoiceNo;
  if (!invoiceNo || /^LOC-/.test(invoiceNo)) {
    invoiceNo = await nextInvoiceNo();
  } else {
    const clash = await Sale.findOne({ invoiceNo });
    if (clash && String(clash.clientSaleId) !== String(payload.clientSaleId)) {
      invoiceNo = await nextInvoiceNo();
    }
  }

  // 4. Customer snapshot + relationship
  let customerId = payload.customer || null;
  let customerClientId = payload.customerClientId || '';
  if (payload.customerClientId || payload.customerName || payload.customerMobile) {
    let existing = null;
    if (payload.customerClientId) existing = await Customer.findOne({ clientId: payload.customerClientId });
    if (!existing && payload.customerMobile) existing = await Customer.findOne({ mobile: payload.customerMobile });
    if (existing) {
      customerId = existing._id;
      customerClientId = existing.clientId || customerClientId;
      existing.totalPurchases = (existing.totalPurchases || 0) + totals.total;
      existing.lastPurchaseAt = new Date();
      await existing.save();
    } else if (payload.customerName) {
      const cust = await Customer.create({
        clientId: payload.customerClientId || genClientId('cust'),
        name: payload.customerName,
        mobile: payload.customerMobile || '',
        gstNumber: payload.customerGst || '',
        address: payload.customerAddress || '',
        totalPurchases: totals.total,
        lastPurchaseAt: new Date(),
      });
      customerId = cust._id;
      customerClientId = cust.clientId;
    }
  }

  // 5. Create sale
  const sale = await Sale.create({
    invoiceNo,
    clientSaleId: payload.clientSaleId,
    branch: payload.branch || payload.branchId || undefined,
    clientDeviceId: deviceId,
    customerClientId: customerClientId || undefined,
    customer: customerId,
    customerSnapshot: {
      name: payload.customerName || '',
      mobile: payload.customerMobile || '',
      gstNumber: payload.customerGst || '',
      address: payload.customerAddress || '',
    },
    items: totals.items.map((i, idx) => ({
      product: i.product,
      productClientId: i.productClientId || undefined,
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
      clientIndex: idx,
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    gstTotal: totals.gstTotal,
    total: totals.total,
    paymentMode: payload.paymentMode || 'cash',
    amountReceived: payload.amountReceived || 0,
    changeDue: payload.changeDue || 0,
    cashier: cashier ? cashier._id : null,
    cashierName: payload.cashierName || (cashier && cashier.name) || 'system',
    deviceId,
    syncSource: payload.syncSource || 'push',
    syncedAt: new Date(),
    createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
  });

  // 6. Stock deduction
  await applySaleStock(sale);

  // 7. Invoice snapshot
  await Invoice.create({
    invoiceNo,
    clientSaleId: payload.clientSaleId,
    sale: sale._id,
    businessName: payload.businessName || '',
    businessAddress: payload.businessAddress || '',
    businessGstin: payload.businessGstin || '',
    businessPhone: payload.businessPhone || '',
    customerName: payload.customerName || '',
    customerMobile: payload.customerMobile || '',
    customerGst: payload.customerGst || '',
    customerAddress: payload.customerAddress || '',
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
    paymentMode: payload.paymentMode || 'cash',
    amountReceived: payload.amountReceived || 0,
    changeDue: payload.changeDue || 0,
    cashierName: sale.cashierName,
    deviceId,
    createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
  });

  return { status: 'created', invoiceNo, saleId: sale._id };
}

/**
 * Processes a batch of offline operations pushed by a device.
 */
async function processPush(deviceId, operations) {
  const results = [];
  for (const op of operations) {
    try {
      if (op.opType === 'sale') {
        const res = await createSaleFromPayload(op.payload, { deviceId });
        results.push({ clientOpId: op.clientOpId, ...res });
      } else if (op.opType === 'purchase') {
        const payload = op.payload;
        let product = null;
        if (payload.product && mongoose.Types.ObjectId.isValid(String(payload.product))) product = await Product.findById(payload.product);
        if (!product && payload.productClientId) product = await Product.findOne({ clientId: payload.productClientId });
        if (!product) {
          results.push({ clientOpId: op.clientOpId, status: 'error', message: 'Product not found' });
          continue;
        }
        const prev = product.stock;
        product.stock = prev + payload.qty;
        product.isLowStock = product.stock <= product.minStock;
        if (payload.costPrice !== undefined) product.purchasePrice = payload.costPrice;
        await product.save();
        await require('../models/Purchase').create({
          product: product._id,
          name: product.name,
          sku: product.sku,
          supplierName: payload.supplierName || '',
          type: payload.type || 'purchase',
          qty: payload.qty,
          costPrice: payload.costPrice || 0,
          total: (payload.costPrice || 0) * payload.qty,
          note: payload.note || '',
          userName: payload.userName || 'system',
          createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
        });
        await require('../models/StockTransaction').create({
          product: product._id,
          name: product.name,
          sku: product.sku,
          type: payload.type || 'purchase',
          qty: payload.qty,
          previousStock: prev,
          newStock: product.stock,
          reference: payload.reference || '',
          note: payload.note || '',
          userName: payload.userName || 'system',
          deviceId,
        });
        results.push({ clientOpId: op.clientOpId, status: 'done' });
      } else if (op.opType === 'stock_adjustment') {
        const payload = op.payload;
        let product = null;
        if (payload.product && mongoose.Types.ObjectId.isValid(String(payload.product))) product = await Product.findById(payload.product);
        if (!product && payload.productClientId) product = await Product.findOne({ clientId: payload.productClientId });
        if (!product) {
          results.push({ clientOpId: op.clientOpId, status: 'error', message: 'Product not found' });
          continue;
        }
        const prev = product.stock;
        product.stock = Math.max(0, prev + payload.delta);
        product.isLowStock = product.stock <= product.minStock;
        await product.save();
        await require('../models/StockTransaction').create({
          product: product._id,
          name: product.name,
          sku: product.sku,
          type: 'adjustment',
          qty: payload.delta,
          previousStock: prev,
          newStock: product.stock,
          reference: payload.reference || '',
          note: payload.note || '',
          userName: payload.userName || 'system',
          deviceId,
        });
        results.push({ clientOpId: op.clientOpId, status: 'done' });
      } else if (['product_create', 'product_update'].includes(op.opType)) {
        const payload = op.payload;
        let product = payload.clientId ? await Product.findOne({ clientId: payload.clientId }) : null;
        if (!product && op.opType === 'product_update' && payload.id && mongoose.Types.ObjectId.isValid(String(payload.id))) {
          product = await Product.findById(payload.id);
        }
        if (product && payload.sku !== undefined) {
          const dup = await Product.findOne({ sku: payload.sku, _id: { $ne: product._id } });
          if (dup) {
            results.push({ clientOpId: op.clientOpId, status: 'error', message: 'SKU already exists' });
            continue;
          }
        }
        if (payload.barcode) {
          const dup = product
            ? await Product.findOne({ barcode: payload.barcode, _id: { $ne: product._id } })
            : await Product.findOne({ barcode: payload.barcode });
          if (dup) {
            results.push({ clientOpId: op.clientOpId, status: 'error', message: 'Barcode already exists' });
            continue;
          }
        }
        if (!product) {
          if (await Product.findOne({ sku: payload.sku })) {
            results.push({ clientOpId: op.clientOpId, status: 'error', message: 'SKU already exists' });
            continue;
          }
          product = new Product({ clientId: payload.clientId || genClientId('prod'), syncedFromCloud: false });
        }
        for (const f of ['name', 'sku', 'barcode', 'category', 'categoryClientId', 'purchasePrice', 'sellingPrice', 'gstRate', 'stock', 'minStock', 'active']) {
          if (payload[f] !== undefined) product[f] = payload[f];
        }
        if (payload.categoryClientId) {
          const cat = await require('../models/Category').findOne({ clientId: payload.categoryClientId });
          if (cat) {
            product.category = cat._id;
            product.categoryName = cat.name;
          }
        }
        if (product.category && mongoose.Types.ObjectId.isValid(String(product.category))) {
          const cat = await require('../models/Category').findById(product.category);
          if (cat) product.categoryName = cat.name;
        }
        product.syncedFromCloud = false;
        product.isLowStock = (product.stock || 0) <= (product.minStock ?? 5);
        await product.save();
        results.push({ clientOpId: op.clientOpId, status: 'done' });
      } else if (['category_create', 'category_update'].includes(op.opType)) {
        const payload = op.payload;
        const Category = require('../models/Category');
        let category = payload.clientId ? await Category.findOne({ clientId: payload.clientId }) : null;
        if (!category && op.opType === 'category_update' && payload.id && mongoose.Types.ObjectId.isValid(String(payload.id))) {
          category = await Category.findById(payload.id);
        }
        if (payload.name) {
          const dup = category
            ? await Category.findOne({ name: payload.name, _id: { $ne: category._id } })
            : await Category.findOne({ name: payload.name });
          if (dup) {
            results.push({ clientOpId: op.clientOpId, status: 'error', message: 'Category name already exists' });
            continue;
          }
        }
        if (!category) category = new Category({ clientId: payload.clientId || genClientId('cat'), syncedFromCloud: false });
        if (payload.name) category.name = payload.name;
        if (payload.description !== undefined) category.description = payload.description;
        category.syncedFromCloud = false;
        await category.save();
        results.push({ clientOpId: op.clientOpId, status: 'done' });
      } else if (['customer_create', 'customer_update'].includes(op.opType)) {
        const payload = op.payload;
        let customer = payload.clientId ? await Customer.findOne({ clientId: payload.clientId }) : null;
        if (!customer && op.opType === 'customer_update' && payload.id && mongoose.Types.ObjectId.isValid(String(payload.id))) {
          customer = await Customer.findById(payload.id);
        }
        if (!customer) customer = new Customer({ clientId: payload.clientId || genClientId('cust') });
        for (const f of ['name', 'mobile', 'email', 'address', 'gstNumber']) {
          if (payload[f] !== undefined) customer[f] = payload[f];
        }
        customer.syncedFromCloud = false;
        await customer.save();
        results.push({ clientOpId: op.clientOpId, status: 'done' });
      } else if (['product_delete', 'category_delete'].includes(op.opType)) {
        const payload = op.payload;
        const isProduct = op.opType === 'product_delete';
        const Model = isProduct ? Product : require('../models/Category');
        let doc = null;
        if (payload.id && mongoose.Types.ObjectId.isValid(String(payload.id))) doc = await Model.findById(payload.id);
        if (!doc && payload.clientId) doc = await Model.findOne({ clientId: payload.clientId });
        if (doc) {
          if (!isProduct) {
            const used = await Product.countDocuments({ category: doc._id });
            if (used > 0) {
              results.push({ clientOpId: op.clientOpId, status: 'error', message: `Category has ${used} products. Move or delete them first.` });
              continue;
            }
          }
          if (doc.clientId) {
            await Tombstone.updateOne(
              { collection: isProduct ? 'Product' : 'Category', clientId: doc.clientId },
              { $setOnInsert: { deletedAt: new Date() } },
              { upsert: true }
            );
          }
          await Model.findByIdAndDelete(doc._id);
        }
        results.push({ clientOpId: op.clientOpId, status: 'done' });
      } else if (op.opType === 'sale_delete') {
        const payload = op.payload;
        const clientSaleId = payload.clientSaleId;
        let sale = null;
        if (clientSaleId) sale = await Sale.findOne({ clientSaleId });
        if (!sale && payload.id && mongoose.Types.ObjectId.isValid(String(payload.id))) sale = await Sale.findById(payload.id);
        if (sale) {
          const tombKey = sale.clientSaleId || `sale-${sale._id}`;
          await Tombstone.updateOne(
            { collection: 'Sale', clientId: tombKey },
            { $setOnInsert: { deletedAt: new Date() } },
            { upsert: true }
          );
          await Invoice.deleteOne({ clientSaleId: sale.clientSaleId });
          await Invoice.deleteOne({ sale: sale._id });
          await Sale.findByIdAndDelete(sale._id);
        }
        results.push({ clientOpId: op.clientOpId, status: 'done' });
      } else if (op.opType === 'customer_delete') {
        const payload = op.payload;
        let customer = null;
        if (payload.clientId) customer = await Customer.findOne({ clientId: payload.clientId });
        if (!customer && payload.id && mongoose.Types.ObjectId.isValid(String(payload.id))) customer = await Customer.findById(payload.id);
        if (customer) {
          if (customer.clientId) {
            await Tombstone.updateOne(
              { collection: 'Customer', clientId: customer.clientId },
              { $setOnInsert: { deletedAt: new Date() } },
              { upsert: true }
            );
          }
          await Customer.findByIdAndDelete(customer._id);
        }
        results.push({ clientOpId: op.clientOpId, status: 'done' });
      } else {
        results.push({ clientOpId: op.clientOpId, status: 'error', message: 'Unknown opType: ' + op.opType });
      }
    } catch (err) {
      results.push({ clientOpId: op.clientOpId, status: 'error', message: err.message });
    }
  }
  return results;
}

/**
 * Pull snapshot of data changed since a timestamp.
 */
async function pullChanges(deviceId, since) {
  const query = since ? { updatedAt: { $gt: new Date(since) } } : {};
  const tombstoneQuery = since ? { deletedAt: { $gt: new Date(since) } } : {};
  const [products, categories, customers, sales, invoices, purchases, tombstones] = await Promise.all([
    Product.find(query).populate('category', 'name').lean(),
    require('../models/Category').find(query).lean(),
    Customer.find(query).lean(),
    Sale.find(since ? { createdAt: { $gt: new Date(since) } } : {}).lean(),
    Invoice.find(since ? { createdAt: { $gt: new Date(since) } } : {}).lean(),
    require('../models/Purchase').find(since ? { createdAt: { $gt: new Date(since) } } : {}).lean(),
    Tombstone.find(tombstoneQuery).lean(),
  ]);

  const licenses = await License.find().lean();

  return {
    products: products.map((p) => ({ ...p, categoryName: p.category && p.category.name })),
    categories,
    customers,
    sales,
    invoices,
    purchases,
    tombstones: tombstones.map((t) => ({ collection: t.collection, clientId: t.clientId, deletedAt: t.deletedAt })),
    licenses,
    serverTime: new Date().toISOString(),
  };
}

module.exports = { processPush, pullChanges, createSaleFromPayload, applySaleStock, refreshLowStock };
