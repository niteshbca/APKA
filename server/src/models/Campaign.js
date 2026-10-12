const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    channel: { type: String, enum: ['email', 'whatsapp'], default: 'email' },
    subject: { type: String, trim: true, default: '' },
    body: { type: String, trim: true, default: '' },
    recipients: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    status: { type: String, enum: ['queued', 'sent', 'partial', 'failed'], default: 'queued' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

campaignSchema.index({ tenant: 1, createdAt: -1 });
campaignSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Campaign', campaignSchema);
