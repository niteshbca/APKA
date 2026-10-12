const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

/**
 * Per-branch notification configuration. Each branch can have its OWN email
 * account (SMTP) and WhatsApp (API token / URL / sender number). Secrets
 * (email password, access token) are never returned to the browser in clear
 * — see toSafeJSON().
 */
const notificationSettingSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },

    email: {
      enabled: { type: Boolean, default: false },
      host: { type: String, trim: true, default: '' },
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false },
      user: { type: String, trim: true, default: '' },
      password: { type: String, default: '' },
      fromName: { type: String, trim: true, default: '' },
      fromEmail: { type: String, trim: true, default: '' },
      replyTo: { type: String, trim: true, default: '' },
    },

    whatsapp: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, enum: ['generic', 'meta', 'ultramsg', 'twilio'], default: 'generic' },
      apiUrl: { type: String, trim: true, default: '' },
      accessToken: { type: String, default: '' },
      instanceId: { type: String, trim: true, default: '' },
      phoneNumberId: { type: String, trim: true, default: '' },
      senderNumber: { type: String, trim: true, default: '' },
    },

    autoSend: {
      onSale: { type: Boolean, default: true },
      onLowStock: { type: Boolean, default: false },
    },

    notify: {
      customerEmail: { type: Boolean, default: true },
      customerWhatsapp: { type: Boolean, default: true },
      ownerEmail: { type: Boolean, default: false },
      ownerWhatsapp: { type: Boolean, default: false },
    },

    ownerEmail: { type: String, trim: true, default: '' },
    ownerWhatsapp: { type: String, trim: true, default: '' },

    template: {
      emailSubject: { type: String, default: 'Your Invoice {{invoiceNo}} from {{businessName}}' },
      emailBody: {
        type: String,
        default:
          'Hello {{customerName}},\n\nThank you for shopping at {{businessName}}.\n\nInvoice: {{invoiceNo}}\nDate: {{date}}\nAmount: {{total}}\nPayment: {{paymentMode}}\n\n{{items}}\n\nWe look forward to serving you again!',
      },
      whatsappBody: {
        type: String,
        default:
          'Hello {{customerName}}! 🧾\nThank you for shopping at *{{businessName}}*.\nInvoice: {{invoiceNo}}\nAmount: *{{total}}*\nPayment: {{paymentMode}}\n{{items}}\n\nSee you soon!',
      },
    },

    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

notificationSettingSchema.index({ tenant: 1, branch: 1 }, { unique: true });
notificationSettingSchema.plugin(tenantPlugin);

function mask(secret) {
  if (!secret) return '';
  const s = String(secret);
  if (s.length <= 4) return '••••';
  return '••••' + s.slice(-4);
}

notificationSettingSchema.methods.toSafeJSON = function () {
  const o = this.toObject();
  o.email = { ...o.email, password: undefined, hasPassword: !!this.email?.password, passwordMask: mask(this.email?.password) };
  o.whatsapp = { ...o.whatsapp, accessToken: undefined, hasAccessToken: !!this.whatsapp?.accessToken, tokenMask: mask(this.whatsapp?.accessToken) };
  return o;
};

module.exports = mongoose.model('NotificationSetting', notificationSettingSchema);
