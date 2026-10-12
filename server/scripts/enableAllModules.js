/**
 * One-off: enable every registered module for all existing tenants so that
 * already-created companies (including the migrated `default` tenant) see the
 * full sidebar without having to toggle each module manually.
 *
 * Safe to re-run. Usage: node scripts/enableAllModules.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../src/config/db');
const Tenant = require('../src/models/Tenant');
const { ALL_KEYS } = require('../src/config/modules');

(async () => {
  await connectDB();
  const tenants = await Tenant.find({});
  let updated = 0;
  for (const t of tenants) {
    t.enabledModules = [...ALL_KEYS];
    t.markModified('enabledModules');
    await t.save();
    updated++;
    console.log(`[modules] ${t.slug || t.name} -> ${ALL_KEYS.length} modules enabled`);
  }
  console.log(`[modules] done. ${updated} tenant(s) updated.`);
  process.exit(0);
})().catch((err) => {
  console.error('[modules] failed:', err.message);
  process.exit(1);
});
