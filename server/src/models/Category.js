const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true, sparse: true, index: true },
    syncedFromCloud: { type: Boolean, default: false },
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, trim: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

categorySchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
