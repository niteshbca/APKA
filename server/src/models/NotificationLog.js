const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

/**
 * Audit trail of every customer notification (email / WhatsApp) triggered by a
 * sale or a manual resend. Lets the UI show delivery status and retry.
 */
const notificationLogSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    invoiceNo: { type: String, trim: true, index: true },
    channel: { type: String, enum: ['email', 'whatsapp'], required: true },
    to: { type: String, trim: true },
    subject: { type: String, trim: true },
    message: { type: String },
    provider: { type: String, trim: true },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], default: 'sent', index: true },
    error: { type: String },
    // Whether the user has acknowledged this log (used by the navbar badge).
    // Successful sends are marked read when the Notifications page is opened;
    // failures stay unread until resolved (e.g. a successful resend).
    read: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

notificationLogSchema.index({ createdAt: -1 });
notificationLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
