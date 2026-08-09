const mongoose = require('mongoose');

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

module.exports = mongoose.model('SyncQueue', syncQueueSchema);
