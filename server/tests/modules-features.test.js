const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, connect, reset, close, registerTenant, auth } = require('./helpers');

let token;

before(async () => {
  await connect();
  await reset();
  const t = await registerTenant('Feature Co', 'featureadmin');
  token = t.token;
  // Enable every module (HR/Accounts/Tasks/AI/Operations/Integrations are opt-in)
  const mods = await request(app).get('/api/modules').set(auth(token));
  const all = mods.body.data.registry.map((m) => m.key);
  const saved = await request(app).put('/api/modules').set(auth(token)).send({ enabledModules: all });
  assert.equal(saved.status, 200);
});

after(async () => { await close(); });

test('HR: create employee, generate & pay salary, summary', async () => {
  const emp = await request(app).post('/api/hr/employees').set(auth(token)).send({ name: 'Ramesh Kumar', designation: 'Cashier', salary: 20000, salaryType: 'monthly' });
  assert.equal(emp.status, 201, JSON.stringify(emp.body));

  const list = await request(app).get('/api/hr/employees').set(auth(token));
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);

  const month = new Date().toISOString().slice(0, 7);
  const gen = await request(app).post('/api/hr/salary/generate').set(auth(token)).send({ month });
  assert.equal(gen.status, 200);
  assert.equal(gen.body.data.created, 1);

  const salary = await request(app).get('/api/hr/salary').set(auth(token)).query({ month });
  assert.equal(salary.body.data.length, 1);
  assert.equal(salary.body.data[0].netPay, 20000);

  const paid = await request(app).put(`/api/hr/salary/${salary.body.data[0]._id}`).set(auth(token)).send({ status: 'paid' });
  assert.equal(paid.body.data.status, 'paid');

  const summary = await request(app).get('/api/hr/summary').set(auth(token)).query({ month });
  assert.equal(summary.body.data.activeCount, 1);
  assert.equal(summary.body.data.paidAmount, 20000);
});

test('Accounts: entry + monthly summary', async () => {
  const e = await request(app).post('/api/accounts/entries').set(auth(token)).send({ type: 'expense', category: 'Rent', amount: 5000 });
  assert.equal(e.status, 201, JSON.stringify(e.body));
  const inc = await request(app).post('/api/accounts/entries').set(auth(token)).send({ type: 'income', category: 'Other', amount: 8000 });
  assert.equal(inc.status, 201);

  const s = await request(app).get('/api/accounts/summary').set(auth(token));
  assert.equal(s.body.data.income, 8000);
  assert.equal(s.body.data.expense, 5000);
  assert.equal(s.body.data.net, 3000);
});

test('Tasks: create + summary', async () => {
  const t = await request(app).post('/api/tasks').set(auth(token)).send({ title: 'Call supplier', assignedTo: 'Ramesh', priority: 'high' });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  const s = await request(app).get('/api/tasks/summary').set(auth(token));
  assert.equal(s.body.data.pending, 1);
});

test('AI assistant answers a business question', async () => {
  const r = await request(app).post('/api/ai/chat').set(auth(token)).send({ message: 'low stock' });
  assert.equal(r.status, 200);
  assert.ok(typeof r.body.reply === 'string' && r.body.reply.length > 0);
});

test('Operations summary + Integrations status respond', async () => {
  const ops = await request(app).get('/api/operations/summary').set(auth(token));
  assert.equal(ops.status, 200);
  assert.ok('transfers' in ops.body.data);

  const int = await request(app).get('/api/integrations/status').set(auth(token));
  assert.equal(int.status, 200);
  assert.ok('email' in int.body.data);
});

test('Marketing audience + Master Data CRUD respond', async () => {
  const audience = await request(app).get('/api/marketing/audience').set(auth(token));
  assert.equal(audience.status, 200);
  assert.ok(Array.isArray(audience.body.data));

  const types = await request(app).get('/api/masters/types').set(auth(token));
  assert.equal(types.status, 200);
  assert.ok(types.body.data.length > 10);

  const created = await request(app).post('/api/masters/brand').set(auth(token)).send({ name: 'Acme', code: 'AC' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const list = await request(app).get('/api/masters/brand').set(auth(token));
  assert.equal(list.body.data.length, 1);
});

test('a brand-new tenant has every registry module enabled by default', async () => {
  const fresh = await registerTenant('Defaults Co', 'defaultsowner');
  const res = await request(app).get('/api/modules').set(auth(fresh.token));
  const registryKeys = res.body.data.registry.map((m) => m.key).sort();
  const enabled = [...res.body.data.enabled].sort();
  assert.deepEqual(enabled, registryKeys, 'a new tenant should see every module in the sidebar');
});
