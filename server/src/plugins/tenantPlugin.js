const mongoose = require('mongoose');
const { getTenantId, isBypass } = require('../config/tenantContext');

/**
 * Shared Mongoose plugin that turns a model into a tenant-scoped model.
 *
 * Adds:
 *   - a `tenant` ObjectId field (ref Tenant, indexed)
 *   - a pre-validate hook that stamps the current tenant on new documents
 *   - pre-query hooks that inject `{ tenant: <current> }` into every read and
 *     write so a tenant can never touch another tenant's data, even if the
 *     route forgets to filter by tenant (defence in depth).
 *
 * Filtering is skipped when:
 *   - there is no tenant in the request context (e.g. login, onboarding)
 *   - the context explicitly sets `bypass: true` (platform admin / workers)
 *   - the caller already specified a `tenant` in the query filter
 */
module.exports = function tenantPlugin(schema, options = {}) {
  if (!schema.path('tenant')) {
    schema.add({
      tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    });
  }

  const readonly = options.readonly === true;

  if (!readonly) {
    schema.pre('validate', function stampTenant(next) {
      if (!this.tenant) {
        const tid = getTenantId();
        if (tid && mongoose.Types.ObjectId.isValid(tid)) this.tenant = tid;
      }
      next();
    });
  }

  function scope(next) {
    if (isBypass()) return next();
    const tid = getTenantId();
    if (!tid || !mongoose.Types.ObjectId.isValid(tid)) return next();
    const filter = typeof this.getFilter === 'function' ? this.getFilter() : {};
    if (filter && filter.tenant === undefined && filter.$and === undefined) {
      this.where({ tenant: tid });
    }
    next();
  }

  const QUERY_OPS = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndReplace',
    'countDocuments',
    'count',
    'distinct',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'replaceOne',
  ];
  QUERY_OPS.forEach((op) => schema.pre(op, scope));

  // Expose a helper to build a tenant-scoped filter explicitly (used by
  // services that need to be defensive, e.g. background jobs opted in).
  schema.statics.tenantFilter = function tenantFilter(extra = {}) {
    const tid = getTenantId();
    if (!tid || !mongoose.Types.ObjectId.isValid(tid) || isBypass()) return { ...extra };
    return { tenant: tid, ...extra };
  };
};
