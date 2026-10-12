const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const tombstoneSchema = new mongoose.Schema(
  {
    collection: { type: String, required: true },
    clientId: { type: String, required: true },
    deletedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

tombstoneSchema.index({ tenant: 1, collection: 1, clientId: 1 }, { unique: true });
tombstoneSchema.index({ deletedAt: 1 });
tombstoneSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Tombstone', tombstoneSchema);
