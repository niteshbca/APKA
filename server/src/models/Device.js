const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, trim: true },
    licenseId: { type: String, index: true },
    name: { type: String, trim: true },
    platform: { type: String, trim: true },
    active: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
    lastSyncAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);
