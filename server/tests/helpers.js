const path = require('path');
const mongoose = require('mongoose');

// Point the app at an isolated, per-process test database BEFORE requiring it.
// dotenv does not override already-set env vars, so these win over .env.
const TEST_DB = `niteshpro_test_${process.pid}_${Math.floor(Math.random() * 100000)}`;
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-please-change-0123456789';
process.env.JWT_EXPIRES_IN = '1h';
delete process.env.DEFAULT_LICENSE_ID;

// eslint-disable-next-line import/no-dynamic-require
const { app } = require(path.join(__dirname, '..', 'src', 'server.js'));
const request = require('supertest');

async function connect() {
  if (mongoose.connection.readyState === 0) {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  }
  // Ensure indexes are built before tests run.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init().catch(() => {})));
}

async function reset() {
  if (mongoose.connection.readyState !== 1) await connect();
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes().catch(() => {})));
}

async function close() {
  await mongoose.connection.close();
}

/**
 * Registers a fresh tenant through the public API and returns { token, tenant, user }.
 */
async function registerTenant(companyName, username, password = 'pass1234') {
  const res = await request(app)
    .post('/api/tenants/register')
    .send({ companyName, ownerName: companyName + ' Owner', username, password, plan: 'starter' });
  if (res.status !== 201) throw new Error('register failed: ' + JSON.stringify(res.body));
  return { token: res.body.token, tenant: res.body.tenant, user: res.body.user };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { app, request, connect, reset, close, registerTenant, auth, mongoose };
