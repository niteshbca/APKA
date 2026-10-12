const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { app, request, connect, reset, close, registerTenant, auth } = require('./helpers');

before(async () => connect());
beforeEach(async () => reset());
after(async () => close());

async function makeProduct(token, overrides = {}) {
  const res = await request(app).post('/api/products').set(auth(token)).send({
    name: 'Widget', sku: 'W-' + Math.random().toString(36).slice(2, 8), sellingPrice: 100, purchasePrice: 60, gstRate: 0, stock: 10,
    ...overrides,
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
}

test('checkout reduces stock exactly once and writes a stock ledger entry', async () => {
  const A = await registerTenant('Checkout Co', 'checkout_owner');
  const product = await makeProduct(A.token);

  const salePayload = {
    clientSaleId: 'sale-test-1',
    paymentMode: 'cash',
    items: [{ product: product._id, name: product.name, sku: product.sku, qty: 2, price: 100, purchasePrice: 60, gstRate: 0 }],
  };

  const sale = await request(app).post('/api/sales').set(auth(A.token)).send(salePayload);
  assert.strictEqual(sale.status, 201, JSON.stringify(sale.body));
  assert.strictEqual(sale.body.data.status, 'created');

  const after = await request(app).get(`/api/products/${product._id}`).set(auth(A.token));
  assert.strictEqual(after.body.data.stock, 8, 'stock reduced by qty once');

  const ledger = await request(app).get('/api/stock/transactions').set(auth(A.token));
  assert.strictEqual(ledger.body.total, 1, 'exactly one stock transaction');
  assert.strictEqual(ledger.body.data[0].qty, -2);

  const invoices = await request(app).get('/api/invoices').set(auth(A.token));
  assert.strictEqual(invoices.body.total, 1, 'exactly one invoice');
});

test('re-posting the same clientSaleId is idempotent (no double stock deduction)', async () => {
  const A = await registerTenant('Idempotent Co', 'idem_owner');
  const product = await makeProduct(A.token);
  const payload = {
    clientSaleId: 'sale-dup-1',
    paymentMode: 'upi',
    items: [{ product: product._id, name: product.name, sku: product.sku, qty: 3, price: 100, gstRate: 0 }],
  };

  const first = await request(app).post('/api/sales').set(auth(A.token)).send(payload);
  assert.strictEqual(first.body.data.status, 'created');

  const second = await request(app).post('/api/sales').set(auth(A.token)).send(payload);
  assert.strictEqual(second.body.data.status, 'duplicate');

  const after = await request(app).get(`/api/products/${product._id}`).set(auth(A.token));
  assert.strictEqual(after.body.data.stock, 7, 'stock deducted only once');

  const invoices = await request(app).get('/api/invoices').set(auth(A.token));
  assert.strictEqual(invoices.body.total, 1, 'no duplicate invoice');
});

test('offline push of a sale is tenant-scoped and consistent', async () => {
  const A = await registerTenant('Push Co', 'push_owner');
  const product = await makeProduct(A.token, { stock: 5 });

  const push = await request(app)
    .post('/api/sync/push')
    .set(auth(A.token))
    .send({
      deviceId: 'device-1',
      operations: [
        {
          clientOpId: 'op-1',
          opType: 'sale',
          payload: {
            clientSaleId: 'offline-sale-1',
            paymentMode: 'cash',
            items: [{ product: product._id, name: product.name, sku: product.sku, qty: 2, price: 100 }],
          },
        },
      ],
    });
  assert.strictEqual(push.status, 200, JSON.stringify(push.body));
  assert.strictEqual(push.body.data.results[0].status, 'created');

  const after = await request(app).get(`/api/products/${product._id}`).set(auth(A.token));
  assert.strictEqual(after.body.data.stock, 3);
});
