const mongoose = require('mongoose');

const tombstoneSchema = new mongoose.Schema(
  {
    collection: { type: String, required: true },
    clientId: { type: String, required: true },
    deletedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

tombstoneSchema.index({ collection: 1, clientId: 1 }, { unique: true });
tombstoneSchema.index({ deletedAt: 1 });

module.exports = mongoose.model('Tombstone', tombstoneSchema);
