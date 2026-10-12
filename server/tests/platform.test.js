const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { app, request, connect, reset, close, registerTenant, auth, mongoose } = require('./helpers');

before(async () => connect());
beforeEach(async () => reset());
after(async () => close());

async function makeLegacySuperadmin(username, password) {
  const User = mongoose.model('User');
  const u = await User.findOne({ username });
  u.role = 'superadmin';
  u.isPlatformAdmin = false;
  await u.save();
  const login = await request(app).post('/api/auth/login').send({ username, password });
  assert.strictEqual(login.status, 200, JSON.stringify(login.body));
  return login.body.token;
}

test('legacy superadmin (not flagged) can access platform APIs', async () => {
  await registerTenant('Legacy Co', 'legacy_owner');
  const token = await makeLegacySuperadmin('legacy_owner', 'pass1234');

  const list = await request(app).get('/api/tenants/platform/list').set(auth(token));
  assert.strictEqual(list.status, 200, JSON.stringify(list.body));
  assert.ok(Array.isArray(list.body.data));
});

test('legacy superadmin can toggle a tenant modules via the platform API', async () => {
  await registerTenant('Legacy Co 2', 'legacy_owner2');
  const token = await makeLegacySuperadmin('legacy_owner2', 'pass1234');

  const list = await request(app).get('/api/tenants/platform/list').set(auth(token));
  const tenantId = list.body.data[0]._id;

  const upd = await request(app)
    .put(`/api/tenants/platform/${tenantId}`)
    .set(auth(token))
    .send({ enabledModules: ['dashboard', 'sales', 'labels'] });
  assert.strictEqual(upd.status, 200, JSON.stringify(upd.body));
  assert.deepStrictEqual([...upd.body.data.enabledModules].sort(), ['dashboard', 'labels', 'sales']);
});

test('a regular tenant admin is still blocked from platform APIs', async () => {
  const A = await registerTenant('Plain Co', 'plain_owner');
  const list = await request(app).get('/api/tenants/platform/list').set(auth(A.token));
  assert.strictEqual(list.status, 403);
  assert.strictEqual(list.body.message, 'Platform administrator access required');
});

test('a tenant admin can save their own tenant modules via /modules', async () => {
  const A = await registerTenant('Modules Co', 'modules_owner');
  const upd = await request(app).put('/api/modules').set(auth(A.token)).send({ enabledModules: ['dashboard', 'sales'] });
  assert.strictEqual(upd.status, 200, JSON.stringify(upd.body));

  const mods = await request(app).get('/api/modules').set(auth(A.token));
  assert.strictEqual(mods.body.data.platform, false);
  assert.deepStrictEqual([...mods.body.data.enabled].sort(), ['dashboard', 'sales']);
});
