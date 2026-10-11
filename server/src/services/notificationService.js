const NotificationSetting = require('../models/NotificationSetting');
const NotificationLog = require('../models/NotificationLog');
const Branch = require('../models/Branch');
const Setting = require('../models/Setting');
const { sendMail } = require('./mailer');

/* ------------------------------- formatting ------------------------------- */

function inr(n) {
  const v = Number(n) || 0;
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizePhone(raw, defaultCountry = '91') {
  if (!raw) return '';
  let digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  digits = digits.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 && defaultCountry) digits = defaultCountry + digits;
  return digits;
}

function renderTemplate(tpl, vars) {
  return String(tpl == null ? '' : tpl).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

function buildItemsText(saleOrInvoice, { whatsapp = false } = {}) {
  const items = saleOrInvoice.items || [];
  return items
    .map((it, i) => {
      const line = `${i + 1}. ${it.name} x${it.qty} = ${inr(it.total != null ? it.total : it.price * it.qty)}`;
      return whatsapp ? line : line;
    })
    .join('\n');
}

function buildVars({ sale, invoice, branch, businessSettings, customer }) {
  const doc = invoice || sale || {};
  const bizName = (businessSettings && businessSettings.businessName) || (branch && branch.name) || 'Our Store';
  const custName = doc.customerName || (sale && sale.customerSnapshot && sale.customerSnapshot.name) || customer?.name || 'Customer';
  const total = doc.total != null ? doc.total : (sale && sale.total) || 0;
  const createdAt = doc.createdAt || (sale && sale.createdAt) || new Date();
  return {
    businessName: bizName,
    businessPhone: (businessSettings && businessSettings.phone) || (branch && branch.phone) || '',
    businessAddress: (businessSettings && businessSettings.address) || (branch && branch.address) || '',
    branchName: branch ? branch.name : '',
    invoiceNo: doc.invoiceNo || '',
    date: new Date(createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    customerName: custName,
    customerMobile: doc.customerMobile || (sale && sale.customerSnapshot && sale.customerSnapshot.mobile) || customer?.mobile || '',
    customerEmail: doc.customerEmail || (sale && sale.customerSnapshot && sale.customerSnapshot.email) || customer?.email || '',
    total: inr(total),
    subtotal: inr(doc.subtotal || (sale && sale.subtotal) || 0),
    gstTotal: inr(doc.gstTotal || (sale && sale.gstTotal) || 0),
    discount: inr(doc.discount || (sale && sale.discount) || 0),
    paymentMode: String(doc.paymentMode || (sale && sale.paymentMode) || '').toUpperCase(),
    items: buildItemsText(sale || doc),
    cashierName: doc.cashierName || (sale && sale.cashierName) || '',
  };
}

function buildEmailHtml(vars, bodyText) {
  const rows = (vars.items || '')
    .split('\n')
    .filter(Boolean)
    .map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${escapeHtml(l)}</td></tr>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f5f6fa;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#4f46e5;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <h2 style="margin:0;font-size:20px">${escapeHtml(vars.businessName)}</h2>
      <div style="opacity:.9;font-size:13px">${escapeHtml(vars.businessAddress || '')}${vars.businessPhone ? ' · ' + escapeHtml(vars.businessPhone) : ''}</div>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px">
      <p style="margin:0 0 12px">Hello <b>${escapeHtml(vars.customerName)}</b>,</p>
      <p style="margin:0 0 16px;color:#4b5563">${escapeHtml(bodyText).replace(/\n/g, '<br/>')}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      <table style="width:100%;margin-top:16px;font-size:14px">
        <tr><td style="color:#6b7280">Subtotal</td><td style="text-align:right">${escapeHtml(vars.subtotal)}</td></tr>
        <tr><td style="color:#6b7280">Discount</td><td style="text-align:right">${escapeHtml(vars.discount)}</td></tr>
        <tr><td style="color:#6b7280">GST</td><td style="text-align:right">${escapeHtml(vars.gstTotal)}</td></tr>
        <tr><td style="font-weight:700;padding-top:8px">Grand Total</td><td style="text-align:right;font-weight:700;font-size:18px;color:#4f46e5">${escapeHtml(vars.total)}</td></tr>
        <tr><td style="color:#6b7280">Payment</td><td style="text-align:right">${escapeHtml(vars.paymentMode)}</td></tr>
      </table>
      <p style="margin-top:20px;color:#6b7280;font-size:13px">Invoice No: <b>${escapeHtml(vars.invoiceNo)}</b> · ${escapeHtml(vars.date)}</p>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">Thank you for your purchase!</p>
  </div></body></html>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* --------------------------------- sending -------------------------------- */

async function log(entry) {
  try {
    await NotificationLog.create(entry);
  } catch (e) {
    console.error('[notify] failed to write log:', e.message);
  }
}

async function sendEmail(settings, { to, subject, bodyText, vars }) {
  const email = settings.email || {};
  if (!email.enabled) return { status: 'skipped', reason: 'email disabled for branch' };
  if (!email.host) return { status: 'skipped', reason: 'SMTP host not configured' };
  if (!to) return { status: 'skipped', reason: 'no recipient email' };
  try {
    await sendMail({
      host: email.host,
      port: Number(email.port) || 587,
      secure: !!email.secure,
      user: email.user,
      pass: email.password,
      from: email.fromEmail || email.user,
      fromName: email.fromName || (vars && vars.businessName) || '',
      to,
      subject,
      text: bodyText,
      html: buildEmailHtml(vars || {}, bodyText),
      replyTo: email.replyTo || undefined,
    });
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

async function sendWhatsapp(settings, { to, message }) {
  const wa = settings.whatsapp || {};
  if (!wa.enabled) return { status: 'skipped', reason: 'whatsapp disabled for branch' };
  const phone = normalizePhone(to);
  if (!phone) return { status: 'skipped', reason: 'no recipient number' };
  const provider = wa.provider || 'generic';

  try {
    if (provider === 'meta') {
      const url = wa.apiUrl || `https://graph.facebook.com/v20.0/${wa.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${wa.accessToken}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || `Meta API ${res.status}`);
      return { status: 'sent', meta: data };
    }

    if (provider === 'ultramsg') {
      const base = wa.apiUrl || 'https://api.ultramsg.com';
      const url = `${base.replace(/\/$/, '')}/${wa.instanceId}/messages/chat`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: wa.accessToken, to: phone, body: message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `UltraMsg API ${res.status}`);
      return { status: 'sent', meta: data };
    }

    if (provider === 'twilio') {
      const sid = wa.instanceId;
      const url = wa.apiUrl || `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const form = new URLSearchParams();
      form.set('From', `whatsapp:${wa.senderNumber}`);
      form.set('To', `whatsapp:+${phone}`);
      form.set('Body', message);
      const auth = Buffer.from(`${sid}:${wa.accessToken}`).toString('base64');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` },
        body: form.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Twilio API ${res.status}`);
      return { status: 'sent', meta: data };
    }

    // Generic provider — POST JSON {to, message, token} to a custom API URL.
    if (!wa.apiUrl) return { status: 'skipped', reason: 'whatsapp API URL not configured' };
    const payload = { to: phone, message, body: message, token: wa.accessToken, sender: wa.senderNumber };
    const res = await fetch(wa.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(wa.accessToken ? { Authorization: `Bearer ${wa.accessToken}` } : {}) },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new Error(text || `WhatsApp API ${res.status}`);
    return { status: 'sent', meta: text.slice(0, 500) };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

/* ------------------------------ orchestration ----------------------------- */

async function getSettings(branchId) {
  if (!branchId) return null;
  return NotificationSetting.findOne({ branch: branchId });
}

async function ensureSettings(branchId, updatedBy) {
  let s = await NotificationSetting.findOne({ branch: branchId });
  if (!s) s = await NotificationSetting.create({ branch: branchId, updatedBy });
  return s;
}

function pickSecret(incoming, existing) {
  if (incoming === undefined) return existing;
  const s = String(incoming == null ? '' : incoming);
  if (!s || /^•+/.test(s)) return existing || '';
  return s;
}

/**
 * Merges incoming config ({email, whatsapp, autoSend, notify, ownerEmail,
 * ownerWhatsapp, template}) into an existing (or new) branch setting.
 * Used by BOTH the Notifications admin page and the Branch create/edit form.
 * Received secret placeholders ("••••….", empty) keep the stored value.
 */
async function updateSettings(branchId, data, userId) {
  const settings = await ensureSettings(branchId, userId);
  const { email = {}, whatsapp = {}, autoSend = {}, notify = {}, ownerEmail, ownerWhatsapp, template = {} } = data || {};

  settings.email = {
    enabled: email.enabled !== undefined ? !!email.enabled : settings.email.enabled,
    host: email.host !== undefined ? email.host : settings.email.host,
    port: email.port !== undefined ? Number(email.port) || 587 : settings.email.port,
    secure: email.secure !== undefined ? !!email.secure : settings.email.secure,
    user: email.user !== undefined ? email.user : settings.email.user,
    password: pickSecret(email.password, settings.email.password),
    fromName: email.fromName !== undefined ? email.fromName : settings.email.fromName,
    fromEmail: email.fromEmail !== undefined ? email.fromEmail : settings.email.fromEmail,
    replyTo: email.replyTo !== undefined ? email.replyTo : settings.email.replyTo,
  };

  settings.whatsapp = {
    enabled: whatsapp.enabled !== undefined ? !!whatsapp.enabled : settings.whatsapp.enabled,
    provider: whatsapp.provider !== undefined ? whatsapp.provider : settings.whatsapp.provider,
    apiUrl: whatsapp.apiUrl !== undefined ? whatsapp.apiUrl : settings.whatsapp.apiUrl,
    accessToken: pickSecret(whatsapp.accessToken, settings.whatsapp.accessToken),
    instanceId: whatsapp.instanceId !== undefined ? whatsapp.instanceId : settings.whatsapp.instanceId,
    phoneNumberId: whatsapp.phoneNumberId !== undefined ? whatsapp.phoneNumberId : settings.whatsapp.phoneNumberId,
    senderNumber: whatsapp.senderNumber !== undefined ? whatsapp.senderNumber : settings.whatsapp.senderNumber,
  };

  if (autoSend.onSale !== undefined) settings.autoSend.onSale = !!autoSend.onSale;
  if (autoSend.onLowStock !== undefined) settings.autoSend.onLowStock = !!autoSend.onLowStock;
  if (notify.customerEmail !== undefined) settings.notify.customerEmail = !!notify.customerEmail;
  if (notify.customerWhatsapp !== undefined) settings.notify.customerWhatsapp = !!notify.customerWhatsapp;
  if (notify.ownerEmail !== undefined) settings.notify.ownerEmail = !!notify.ownerEmail;
  if (notify.ownerWhatsapp !== undefined) settings.notify.ownerWhatsapp = !!notify.ownerWhatsapp;
  if (ownerEmail !== undefined) settings.ownerEmail = ownerEmail;
  if (ownerWhatsapp !== undefined) settings.ownerWhatsapp = ownerWhatsapp;
  if (template.emailSubject !== undefined) settings.template.emailSubject = template.emailSubject;
  if (template.emailBody !== undefined) settings.template.emailBody = template.emailBody;
  if (template.whatsappBody !== undefined) settings.template.whatsappBody = template.whatsappBody;
  settings.updatedBy = userId;

  await settings.save();
  return settings;
}

/**
 * Sends the configured sale notifications to the customer (and optionally the
 * owner). Never throws — failures are captured in NotificationLog.
 */
async function dispatchSaleNotifications({ sale, invoice, branchId, customer }) {
  try {
    if (!branchId) return;
    const settings = await NotificationSetting.findOne({ branch: branchId });
    if (!settings) return;
    if (!settings.autoSend || settings.autoSend.onSale === false) return;

    const [branch, businessSettings] = await Promise.all([
      Branch.findById(branchId).lean(),
      Setting.findOne({ key: 'business' }).lean(),
    ]);
    const vars = buildVars({ sale, invoice, branch, businessSettings, customer });
    const emailSubject = renderTemplate(settings.template.emailSubject, vars);
    const emailBody = renderTemplate(settings.template.emailBody, vars);
    const waBody = renderTemplate(settings.template.whatsappBody, vars);

    const recipientEmail =
      (sale && sale.customerSnapshot && sale.customerSnapshot.email) ||
      (invoice && invoice.customerEmail) ||
      customer?.email ||
      '';
    const recipientPhone =
      (sale && sale.customerSnapshot && sale.customerSnapshot.mobile) ||
      (invoice && invoice.customerMobile) ||
      customer?.mobile ||
      '';

    const tasks = [];
    if (settings.notify.customerEmail && recipientEmail) {
      tasks.push(
        (async () => {
          const r = await sendEmail(settings, { to: recipientEmail, subject: emailSubject, bodyText: emailBody, vars });
          await log({ branch: branchId, sale: sale?._id, invoiceNo: vars.invoiceNo, channel: 'email', to: recipientEmail, subject: emailSubject, message: emailBody, provider: 'smtp', status: r.status, error: r.error || r.reason });
        })()
      );
    }
    if (settings.notify.ownerEmail && settings.ownerEmail) {
      tasks.push(
        (async () => {
          const r = await sendEmail(settings, { to: settings.ownerEmail, subject: '[Copy] ' + emailSubject, bodyText: emailBody, vars });
          await log({ branch: branchId, sale: sale?._id, invoiceNo: vars.invoiceNo, channel: 'email', to: settings.ownerEmail, subject: emailSubject, message: emailBody, provider: 'smtp', status: r.status, error: r.error || r.reason, meta: { owner: true } });
        })()
      );
    }
    if (settings.notify.customerWhatsapp && recipientPhone) {
      tasks.push(
        (async () => {
          const r = await sendWhatsapp(settings, { to: recipientPhone, message: waBody });
          await log({ branch: branchId, sale: sale?._id, invoiceNo: vars.invoiceNo, channel: 'whatsapp', to: normalizePhone(recipientPhone), message: waBody, provider: settings.whatsapp.provider, status: r.status, error: r.error || r.reason, meta: r.meta });
        })()
      );
    }
    if (settings.notify.ownerWhatsapp && settings.ownerWhatsapp) {
      tasks.push(
        (async () => {
          const r = await sendWhatsapp(settings, { to: settings.ownerWhatsapp, message: waBody });
          await log({ branch: branchId, sale: sale?._id, invoiceNo: vars.invoiceNo, channel: 'whatsapp', to: normalizePhone(settings.ownerWhatsapp), message: waBody, provider: settings.whatsapp.provider, status: r.status, error: r.error || r.reason, meta: r.meta });
        })()
      );
    }
    await Promise.all(tasks);
  } catch (err) {
    console.error('[notify] dispatch failed:', err.message);
  }
}

/**
 * Sends an invoice to the customer ON DEMAND (e.g. the "Send Email / Send
 * WhatsApp" buttons on the billing screen), ignoring the autoSend toggle but
 * still using the branch's configured SMTP / WhatsApp credentials.
 * Returns per-channel results. Never throws.
 */
async function sendInvoiceNow(branchId, { channel = 'both', email, phone, invoice, sale }) {
  const results = { email: null, whatsapp: null };
  try {
    if (!branchId) return { results, error: 'Branch is required' };
    const settings = await NotificationSetting.findOne({ branch: branchId });
    if (!settings) return { results, error: 'Is branch ke liye Notification settings save nahi hain' };

    const [branch, businessSettings] = await Promise.all([
      Branch.findById(branchId).lean(),
      Setting.findOne({ key: 'business' }).lean(),
    ]);
    const vars = buildVars({ sale, invoice, branch, businessSettings, customer: null });
    const emailSubject = renderTemplate(settings.template.emailSubject, vars);
    const emailBody = renderTemplate(settings.template.emailBody, vars);
    const waBody = renderTemplate(settings.template.whatsappBody, vars);

    const raw = settings.toObject();
    const forced = {
      ...raw,
      email: { ...raw.email, enabled: true },
      whatsapp: { ...raw.whatsapp, enabled: true },
    };

    if (channel === 'email' || channel === 'both') {
      const to = email || vars.customerEmail || '';
      const r = await sendEmail(forced, { to, subject: emailSubject, bodyText: emailBody, vars });
      results.email = { ...r, to };
      await log({ branch: branchId, invoiceNo: vars.invoiceNo, channel: 'email', to, subject: emailSubject, message: emailBody, provider: 'smtp', status: r.status, error: r.error || r.reason, meta: { manual: true } });
    }

    if (channel === 'whatsapp' || channel === 'both') {
      const to = phone || vars.customerMobile || '';
      const r = await sendWhatsapp(forced, { to, message: waBody });
      results.whatsapp = { ...r, to: normalizePhone(to) };
      await log({ branch: branchId, invoiceNo: vars.invoiceNo, channel: 'whatsapp', to: normalizePhone(to), message: waBody, provider: raw.whatsapp.provider, status: r.status, error: r.error || r.reason, meta: { ...(r.meta || {}), manual: true } });
    }

    return { results };
  } catch (err) {
    return { results, error: err.message };
  }
}

async function testEmail(branchId, to) {
  const settings = await ensureSettings(branchId);
  const email = settings.email || {};
  if (!email.host) return { status: 'skipped', reason: 'SMTP host not configured' };
  const vars = { businessName: email.fromName || 'POS', invoiceNo: 'TEST-0001', date: new Date().toLocaleString(), customerName: 'Test', total: inr(0), subtotal: inr(0), discount: inr(0), gstTotal: inr(0), paymentMode: 'CASH', items: 'This is a test notification from your POS.', cashierName: 'system' };
  const subject = `POS test email — ${vars.businessName}`;
  const body = 'This is a test email sent from your POS notification settings. If you received it, your SMTP configuration is correct.';
  const r = await sendEmail({ ...settings.toObject(), email: { ...email, enabled: true } }, { to: to || email.fromEmail || email.user, subject, bodyText: body, vars });
  await log({ branch: branchId, channel: 'email', to: to || email.fromEmail || email.user, subject, message: body, provider: 'smtp', status: r.status, error: r.error || r.reason, meta: { test: true } });
  return r;
}

async function testWhatsapp(branchId, to) {
  const settings = await ensureSettings(branchId);
  const wa = settings.whatsapp || {};
  const message = 'This is a test WhatsApp message from your POS notification settings. Configuration looks good!';
  const r = await sendWhatsapp({ ...settings.toObject(), whatsapp: { ...wa, enabled: true } }, { to: to || wa.senderNumber, message });
  await log({ branch: branchId, channel: 'whatsapp', to: normalizePhone(to || wa.senderNumber), message, provider: wa.provider, status: r.status, error: r.error || r.reason, meta: { ...(r.meta || {}), test: true } });
  return r;
}

module.exports = {
  dispatchSaleNotifications,
  getSettings,
  ensureSettings,
  updateSettings,
  sendInvoiceNow,
  testEmail,
  testWhatsapp,
  sendWhatsapp,
  renderTemplate,
  buildVars,
  normalizePhone,
  inr,
};
