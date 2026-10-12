const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

/**
 * Generic master/configuration record. `type` selects the semantic entity
 * (brand, unit, tax, department, ...). Never used for daily transactional data.
 */
const masterRecordSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    code: { type: String, trim: true, uppercase: true, default: '' },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

masterRecordSchema.index({ tenant: 1, type: 1, name: 1 }, { unique: true });
masterRecordSchema.index({ tenant: 1, type: 1, code: 1 }, { unique: true, sparse: true });
masterRecordSchema.plugin(tenantPlugin);

module.exports = mongoose.model('MasterRecord', masterRecordSchema);
