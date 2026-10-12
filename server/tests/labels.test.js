const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { app, request, connect, reset, close, registerTenant, auth } = require('./helpers');

before(async () => connect());
beforeEach(async () => reset());
after(async () => close());

const VALID_EAN13 = '4006381333931'; // checksum-valid
const NOT_EAN = 'ABC-INTERNAL-1';

test('barcode lookup resolves product and classifies symbology without changing stock', async () => {
  const A = await registerTenant('Label Co', 'label_owner');
  const p1 = await request(app).post('/api/products').set(auth(A.token)).send({
    name: 'EAN Product', sku: 'EAN-1', barcode: VALID_EAN13, sellingPrice: 250, mrp: 300, stock: 40, gstRate: 18,
  });
  assert.strictEqual(p1.status, 201);
  await request(app).post('/api/products').set(auth(A.token)).send({
    name: 'Internal Product', sku: 'INT-1', barcode: NOT_EAN, sellingPrice: 50, stock: 10,
  });

  const lookup1 = await request(app).get(`/api/labels/lookup/${VALID_EAN13}`).set(auth(A.token));
  assert.strictEqual(lookup1.status, 200);
  assert.strictEqual(lookup1.body.data.barcodeFormat, 'ean13');
  assert.strictEqual(lookup1.body.data.barcodeValidEan, true);
  assert.strictEqual(lookup1.body.data.sellingPrice, 250);
  assert.strictEqual(lookup1.body.data.stock, 40, 'lookup must not change stock');

  const lookup2 = await request(app).get(`/api/labels/lookup/${NOT_EAN}`).set(auth(A.token));
  assert.strictEqual(lookup2.status, 200);
  assert.strictEqual(lookup2.body.data.barcodeFormat, 'code128');
  assert.strictEqual(lookup2.body.data.barcodeValidEan, false);

  const missing = await request(app).get('/api/labels/lookup/NOPE-404').set(auth(A.token));
  assert.strictEqual(missing.status, 404);
});

test('label templates are created, defaulted and isolated per tenant', async () => {
  const A = await registerTenant('Label Co A', 'label_a');
  const B = await registerTenant('Label Co B', 'label_b');

  const create = await request(app).post('/api/labels/templates').set(auth(A.token)).send({
    name: 'Retail 50x25',
    preset: '50x25',
    size: { widthMm: 50, heightMm: 25 },
    barcodeType: 'auto',
    showQr: true,
    isDefault: true,
    fields: [
      { key: 'productName', enabled: true, order: 0, fontSize: 8, align: 'center' },
      { key: 'sellingPrice', enabled: true, order: 1, fontSize: 10, align: 'center', bold: true },
    ],
  });
  assert.strictEqual(create.status, 201, JSON.stringify(create.body));
  assert.strictEqual(create.body.data.isDefault, true);

  const listA = await request(app).get('/api/labels/templates').set(auth(A.token));
  assert.strictEqual(listA.body.data.length, 1);

  const listB = await request(app).get('/api/labels/templates').set(auth(B.token));
  assert.strictEqual(listB.body.data.length, 0, 'tenant B must not see tenant A templates');
});

test('printing labels requires the print permission and records history', async () => {
  const A = await registerTenant('Label Co C', 'label_c');
  const prod = await request(app).post('/api/products').set(auth(A.token)).send({
    name: 'Print Me', sku: 'PM-1', barcode: VALID_EAN13, sellingPrice: 99, stock: 3,
  });
  const productId = prod.body.data._id;

  const log = await request(app).post('/api/labels/logs').set(auth(A.token)).send({
    mode: 'selection',
    items: [{ product: productId, name: 'Print Me', sku: 'PM-1', barcode: VALID_EAN13, qty: 5 }],
  });
  assert.strictEqual(log.status, 201);
  assert.strictEqual(log.body.data.labelCount, 5);

  const history = await request(app).get('/api/labels/logs').set(auth(A.token));
  assert.strictEqual(history.body.total, 1);
});

test('disabling the labels module blocks the label API', async () => {
  const A = await registerTenant('Label Co D', 'label_d');
  await request(app).put('/api/modules').set(auth(A.token)).send({ enabledModules: ['dashboard', 'sales', 'products'] });
  const blocked = await request(app).get('/api/labels/templates').set(auth(A.token));
  assert.strictEqual(blocked.status, 403);
  assert.strictEqual(blocked.body.code, 'MODULE_DISABLED');
});
