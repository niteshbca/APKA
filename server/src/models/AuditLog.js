const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

/**
 * Append-only audit trail for sensitive/administrative actions. Sensitive
 * values are never stored here (no passwords, tokens or full personal data).
 */
const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, trim: true, default: '' },
    action: { type: String, required: true, trim: true, index: true },
    entity: { type: String, trim: true, default: '' },
    entityId: { type: String, trim: true, default: '' },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    ip: { type: String, trim: true, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('AuditLog', auditLogSchema);
