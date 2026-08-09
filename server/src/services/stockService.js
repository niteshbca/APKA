const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');

/**
 * Adjusts product stock and records a stock transaction.
 * @param {Object} product Product document (or {_id,name,sku})
 * @param {number} delta signed change (-qty for sale, +qty for purchase)
 * @param {'sale'|'purchase'|'adjustment'|'opening'} type
 * @param {Object} opts
 */
async function adjustStock(product, delta, type, opts = {}) {
  const { reference = '', note = '', user = null, userName = '', deviceId = '', clientId = '', productClientId = '' } = opts;
  const current = await Product.findById(product._id || product).session(opts.session || null);

  const previousStock = current ? current.stock : 0;
  const newStock = Math.max(0, previousStock + delta);

  if (current) {
    current.stock = newStock;
    current.isLowStock = newStock <= current.minStock;
    await current.save({ session: opts.session || null });
  }

  await StockTransaction.create(
    {
      clientId: clientId || undefined,
      productClientId: productClientId || current?.clientId || undefined,
      product: product._id || product,
      name: product.name || current?.name,
      sku: product.sku || current?.sku,
      type,
      qty: delta,
      previousStock,
      newStock,
      reference,
      note,
      user,
      userName,
      deviceId,
    },
    { session: opts.session || null }
  );
}

module.exports = { adjustStock };
