const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const syncQueueSchema = new mongoose.Schema(
  {
    deviceId: { type: String, index: true },
    clientOpId: { type: String, index: true },
    opType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    error: { type: String },
    result: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

syncQueueSchema.index({ status: 1, createdAt: 1 });
syncQueueSchema.index({ tenant: 1, clientOpId: 1 });
syncQueueSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SyncQueue', syncQueueSchema);
