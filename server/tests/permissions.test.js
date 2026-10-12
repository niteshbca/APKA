const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { app, request, connect, reset, close, registerTenant, auth } = require('./helpers');

before(async () => connect());
beforeEach(async () => reset());
after(async () => close());

async function createUserAndLogin(adminToken, body) {
  const created = await request(app).post('/api/users').set(auth(adminToken)).send(body);
  assert.strictEqual(created.status, 201, JSON.stringify(created.body));
  const login = await request(app).post('/api/auth/login').send({ username: body.username, password: body.password });
  assert.strictEqual(login.status, 200, JSON.stringify(login.body));
  return login.body.token;
}

test('cashier cannot create products or list users; admin can', async () => {
  const A = await registerTenant('Perm Co', 'perm_owner');
  const cashierToken = await createUserAndLogin(A.token, {
    name: 'Cashier One',
    username: 'cashier_perm',
    password: 'pass1234',
    role: 'cashier',
  });

  const createProduct = await request(app)
    .post('/api/products')
    .set(auth(cashierToken))
    .send({ name: 'X', sku: 'X-1', sellingPrice: 10 });
  assert.strictEqual(createProduct.status, 403);

  const listUsers = await request(app).get('/api/users').set(auth(cashierToken));
  assert.strictEqual(listUsers.status, 403);

  const viewProducts = await request(app).get('/api/products').set(auth(cashierToken));
  assert.strictEqual(viewProducts.status, 200);

  const adminCreate = await request(app)
    .post('/api/products')
    .set(auth(A.token))
    .send({ name: 'X', sku: 'X-1', sellingPrice: 10 });
  assert.strictEqual(adminCreate.status, 201);
});

test('permission catalog is exposed and permissions are enforced from the DB, not the token', async () => {
  const A = await registerTenant('Perm Co 2', 'perm_owner2');
  const catalog = await request(app).get('/api/users/permissions').set(auth(A.token));
  assert.strictEqual(catalog.status, 200);
  assert.ok(catalog.body.data.permissions.length > 10);
  assert.ok(catalog.body.data.roles.cashier.includes('sales.create'));

  const cashierToken = await createUserAndLogin(A.token, {
    name: 'Cashier Two',
    username: 'cashier_perm2',
    password: 'pass1234',
    role: 'cashier',
  });

  // Change the cashier's role in the DB after the token was issued.
  const users = await request(app).get('/api/users').set(auth(A.token));
  const cashier = users.body.data.find((u) => u.username === 'cashier_perm2');
  await request(app).put(`/api/users/${cashier._id}`).set(auth(A.token)).send({ role: 'admin' });

  // The old cashier token must now behave as the updated role (admin can edit products).
  const edit = await request(app).put('/api/products/000000000000000000000000').set(auth(cashierToken)).send({ name: 'n' });
  // admin is allowed to reach the route; it 404s because the product doesn't exist (not 403).
  assert.notStrictEqual(edit.status, 403);
});

test('only platform admin can list all tenants', async () => {
  const A = await registerTenant('Platform Co', 'platform_owner');
  const forbidden = await request(app).get('/api/tenants/platform/list').set(auth(A.token));
  assert.strictEqual(forbidden.status, 403, 'tenant admin must not list all tenants');
});

test('invalid or missing token is rejected', async () => {
  const noToken = await request(app).get('/api/products');
  assert.strictEqual(noToken.status, 401);
  const badToken = await request(app).get('/api/products').set({ Authorization: 'Bearer nonsense' });
  assert.strictEqual(badToken.status, 401);
});
