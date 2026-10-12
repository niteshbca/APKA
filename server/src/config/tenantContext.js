const { AsyncLocalStorage } = require('async_hooks');

/**
 * Request-scoped tenant context.
 *
 * Every authenticated request runs inside an AsyncLocalStorage store that
 * carries the resolved tenant id. The shared `tenantPlugin` reads this store
 * to automatically scope every Mongoose read/write to the current tenant.
 *
 * This is the server-side enforcement layer: the client can never pick a
 * tenant by supplying tenant_id — the id is derived from the authenticated
 * user's membership (see middleware/auth.js).
 */
const als = new AsyncLocalStorage();

function runWithTenant(ctx, fn) {
  return als.run(ctx || {}, fn);
}

function getStore() {
  return als.getStore() || null;
}

function getTenantId() {
  const store = getStore();
  return store && store.tenantId ? String(store.tenantId) : null;
}

/**
 * When true, the shared tenant plugin does NOT add a tenant filter.
 * Reserved for the platform administrator's global views and for background
 * workers (cloud sync) that intentionally operate across tenants.
 */
function isBypass() {
  const store = getStore();
  return !!(store && store.bypass);
}

module.exports = { als, runWithTenant, getStore, getTenantId, isBypass };
