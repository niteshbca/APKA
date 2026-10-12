/**
 * Multi-tenant migration (idempotent, safe to re-run).
 *
 * What it does:
 *   1. Creates a default tenant representing the existing single-company data.
 *   2. Backfills `tenant` on every business collection that is missing it.
 *   3. Promotes existing `superadmin` users to platform administrators.
 *   4. Drops obsolete GLOBAL unique indexes that would otherwise prevent two
 *      tenants from reusing the same SKU / barcode / branch code / etc.
 *      Mongoose then builds the new per-tenant compound indexes on next boot.
 *
 * It NEVER deletes business data.
 *
 * Usage:  npm run migrate:tenants --prefix server
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Tenant = require('../src/models/Tenant');
const { ALL_KEYS } = require('../src/config/modules');

const SCOPED_COLLECTIONS = [
  'users',
  'branches',
  'categories',
  'products',
  'sales',
  'invoices',
  'purchases',
  'stocktransactions',
  'settings',
  'licenses',
  'devices',
  'counters',
  'syncqueues',
  'tombstones',
  'notificationsettings',
  'notificationlogs',
];

// Old global unique indexes replaced by per-tenant compound indexes.
const OBSOLETE_INDEXES = {
  branches: ['code_1'],
  categories: ['branch_1_name_1', 'branch_1_slug_1'],
  products: ['sku_1', 'barcode_1'],
  sales: ['invoiceNo_1'],
  invoices: ['invoiceNo_1'],
  settings: ['key_1'],
  counters: ['name_1'],
  notificationsettings: ['branch_1'],
  tombstones: ['collection_1_clientId_1'],
};

async function dropIndexIfExists(db, collection, indexName) {
  try {
    await db.collection(collection).dropIndex(indexName);
    console.log(`  - dropped obsolete index ${collection}.${indexName}`);
  } catch (err) {
    if (err.codeName === 'IndexNotFound' || err.code === 27) return;
    console.warn(`  ! could not drop ${collection}.${indexName}: ${err.message}`);
  }
}

async function main() {
  await connectDB();
  const db = mongoose.connection.db;

  console.log('[migrate] creating/finding default tenant...');
  let tenant = await Tenant.findOne({ slug: 'default' });
  if (!tenant) {
    tenant = await Tenant.create({
      clientId: 'ten-default',
      name: 'NiteshPro Default Company',
      slug: 'default',
      status: 'active',
      plan: 'enterprise',
      enabledModules: ALL_KEYS,
      limits: { maxBranches: 1000, maxUsers: 5000, maxProducts: 1000000, maxDevices: 1000 },
    });
    console.log(`[migrate] default tenant created: ${tenant._id}`);
  } else {
    console.log(`[migrate] default tenant exists: ${tenant._id}`);
  }

  console.log('[migrate] backfilling tenant on all collections...');
  for (const name of SCOPED_COLLECTIONS) {
    const res = await db.collection(name).updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenant._id } }
    );
    if (res.modifiedCount) console.log(`  - ${name}: ${res.modifiedCount} documents tagged`);
  }

  // Promote legacy superadmins to platform administrators.
  const promoted = await db
    .collection('users')
    .updateMany({ role: 'superadmin', isPlatformAdmin: { $ne: true } }, { $set: { isPlatformAdmin: true } });
  if (promoted.modifiedCount) console.log(`  - users: ${promoted.modifiedCount} superadmins flagged as platform admins`);

  console.log('[migrate] dropping obsolete global unique indexes...');
  for (const [collection, indexes] of Object.entries(OBSOLETE_INDEXES)) {
    for (const idx of indexes) {
      await dropIndexIfExists(db, collection, idx);
    }
  }

  console.log('[migrate] done. Restart the server so Mongoose builds the new indexes.');
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
