const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const categorySchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true, sparse: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    syncedFromCloud: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true },
    description: { type: String, trim: true },
    image: { type: String, trim: true },
  },
  { timestamps: true }
);

categorySchema.index({ tenant: 1, branch: 1, name: 1 }, { unique: true });
categorySchema.index({ tenant: 1, branch: 1, slug: 1 }, { unique: true, sparse: true });
categorySchema.plugin(tenantPlugin);

categorySchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
