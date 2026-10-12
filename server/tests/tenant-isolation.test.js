const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { app, request, connect, reset, close, registerTenant, auth } = require('./helpers');

before(async () => connect());
beforeEach(async () => reset());
after(async () => close());

let A;
let B;

async function setupTwoTenants() {
  A = await registerTenant('Alpha Traders', 'alpha_owner');
  B = await registerTenant('Beta Stores', 'beta_owner');
}

test('tenant A cannot see tenant B products (list isolation)', async () => {
  await setupTwoTenants();
  const create = await request(app)
    .post('/api/products')
    .set(auth(A.token))
    .send({ name: 'Alpha Widget', sku: 'ALPHA-1', sellingPrice: 100, stock: 5 });
  assert.strictEqual(create.status, 201);
  const idA = create.body.data._id;

  const listA = await request(app).get('/api/products').set(auth(A.token));
  assert.strictEqual(listA.status, 200);
  assert.strictEqual(listA.body.data.length, 1);

  const listB = await request(app).get('/api/products').set(auth(B.token));
  assert.strictEqual(listB.status, 200);
  assert.strictEqual(listB.body.data.length, 0, 'tenant B must not see tenant A products');

  // Cross-tenant IDOR: direct id access must 404 for the other tenant.
  const byIdB = await request(app).get(`/api/products/${idA}`).set(auth(B.token));
  assert.strictEqual(byIdB.status, 404, 'tenant B must not fetch tenant A product by id');
});

test('tenant B cannot update or delete tenant A product', async () => {
  await setupTwoTenants();
  const create = await request(app)
    .post('/api/products')
    .set(auth(A.token))
    .send({ name: 'Alpha Widget', sku: 'ALPHA-2', sellingPrice: 100, stock: 5 });
  const idA = create.body.data._id;

  const upd = await request(app).put(`/api/products/${idA}`).set(auth(B.token)).send({ name: 'hacked' });
  assert.ok([403, 404].includes(upd.status), 'tenant B update must be blocked');

  const del = await request(app).delete(`/api/products/${idA}`).set(auth(B.token));
  assert.ok([403, 404].includes(del.status), 'tenant B delete must be blocked');

  const stillThere = await request(app).get(`/api/products/${idA}`).set(auth(A.token));
  assert.strictEqual(stillThere.status, 200);
  assert.strictEqual(stillThere.body.data.name, 'Alpha Widget');
});

test('tenant scoping isolates customers and dashboard', async () => {
  await setupTwoTenants();
  await request(app).post('/api/customers').set(auth(A.token)).send({ name: 'Cust A', mobile: '9999999999' });

  const custB = await request(app).get('/api/customers').set(auth(B.token));
  assert.strictEqual(custB.body.data.length, 0);

  const dashB = await request(app).get('/api/dashboard').set(auth(B.token));
  assert.strictEqual(dashB.status, 200);
  assert.strictEqual(dashB.body.data.totals.invoices, 0);
});

test('tenant module configuration is isolated per tenant', async () => {
  await setupTwoTenants();
  await request(app).put('/api/modules').set(auth(A.token)).send({ enabledModules: ['dashboard', 'sales'] });

  const modsA = await request(app).get('/api/modules').set(auth(A.token));
  assert.ok(!modsA.body.data.enabled.includes('labels'));
  assert.ok(modsA.body.data.enabled.includes('sales'));

  const modsB = await request(app).get('/api/modules').set(auth(B.token));
  assert.ok(modsB.body.data.enabled.includes('labels'), 'tenant B keeps its own module config');
});
