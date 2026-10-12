const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const counterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

counterSchema.index({ tenant: 1, name: 1 }, { unique: true });
counterSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Counter', counterSchema);
