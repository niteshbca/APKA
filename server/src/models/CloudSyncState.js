const mongoose = require('mongoose');

const cloudSyncStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'state' },
    deviceId: { type: String, default: '' },
    lastPushAt: { type: Date, default: null },
    lastPullAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
    online: { type: Boolean, default: false },
    syncing: { type: Boolean, default: false },
    lastSyncDurationMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CloudSyncState', cloudSyncStateSchema);
