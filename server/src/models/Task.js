const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    assignedTo: { type: String, trim: true, default: '' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['pending', 'in_progress', 'done'], default: 'pending', index: true },
    dueDate: { type: Date },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

taskSchema.index({ tenant: 1, status: 1, dueDate: 1 });
taskSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Task', taskSchema);
