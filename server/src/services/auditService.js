const AuditLog = require('../models/AuditLog');

/**
 * Records an audit event. Fire-and-forget: auditing must never break the
 * primary request. Never pass secrets/passwords into `meta`.
 */
async function record(req, { action, entity, entityId, outcome = 'success', meta = {} } = {}) {
  try {
    await AuditLog.create({
      user: req && req.userId ? req.userId : undefined,
      userName: req && req.userDoc ? req.userDoc.name : '',
      action,
      entity: entity || '',
      entityId: entityId ? String(entityId) : '',
      outcome,
      ip: (req && (req.headers['x-forwarded-for'] || req.ip)) || '',
      meta,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record:', err.message);
  }
}

module.exports = { record };
