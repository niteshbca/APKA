const express = require('express');
const NotificationSetting = require('../models/NotificationSetting');
const NotificationLog = require('../models/NotificationLog');
const Branch = require('../models/Branch');
const { verifyToken, requireRoles } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

router.use(verifyToken);

function resolveBranchId(req) {
  if (req.userRole !== 'superadmin' && req.userBranch) return String(req.userBranch);
  return req.query.branch || req.body.branch || null;
}

/** GET settings for a branch (secrets are masked out). */
router.get('/settings', async (req, res, next) => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) return res.json({ success: true, data: null });
    const settings = await notificationService.ensureSettings(branchId, req.userId);
    res.json({ success: true, data: settings.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

/** Upsert settings for a branch. */
router.put('/settings', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) return res.status(400).json({ success: false, message: 'Branch is required' });
    const branch = await Branch.findById(branchId);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });
    const settings = await notificationService.updateSettings(branchId, req.body, req.userId);
    res.json({ success: true, data: settings.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

/**
 * Send an invoice to the customer on demand (billing screen buttons).
 * Any signed-in user (e.g. a cashier) may send; uses branch settings.
 */
router.post('/send', async (req, res, next) => {
  try {
    const branchId = resolveBranchId(req) || (req.body && req.body.branch);
    if (!branchId) return res.status(400).json({ success: false, message: 'Branch is required' });
    const { channel = 'both', email, phone, invoice, sale } = req.body || {};
    const out = await notificationService.sendInvoiceNow(branchId, { channel, email, phone, invoice, sale });
    const r = out.results || {};
    const ok = r.email?.status === 'sent' || r.whatsapp?.status === 'sent';
    res.json({
      success: ok,
      data: out,
      message: out.error || r.email?.error || r.email?.reason || r.whatsapp?.error || r.whatsapp?.reason || (ok ? 'Sent' : 'Not sent'),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/test-email', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) return res.status(400).json({ success: false, message: 'Branch is required' });
    const result = await notificationService.testEmail(branchId, req.body.to);
    res.json({ success: result.status === 'sent', data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * Diagnose email connectivity: probes the configured SMTP host on each common
 * port from THIS server so the admin can see whether outbound SMTP is blocked
 * and should switch to an HTTPS API provider.
 */
router.post('/diagnose-email', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) return res.status(400).json({ success: false, message: 'Branch is required' });
    const result = await notificationService.diagnoseEmail(branchId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/test-whatsapp', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) return res.status(400).json({ success: false, message: 'Branch is required' });
    const result = await notificationService.testWhatsapp(branchId, req.body.to);
    res.json({ success: result.status === 'sent', data: result });
  } catch (err) {
    next(err);
  }
});

/** Delivery log for a branch. */
router.get('/logs', async (req, res, next) => {
  try {
    const branchId = resolveBranchId(req);
    const { page = 1, limit = 50, channel, status } = req.query;
    const query = {};
    if (branchId) query.branch = branchId;
    if (channel) query.channel = channel;
    if (status) query.status = status;
    const total = await NotificationLog.countDocuments(query);
    const data = await NotificationLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, data, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

/** Resend a previously logged notification. */
router.post('/resend/:logId', requireRoles('superadmin', 'admin'), async (req, res, next) => {
  try {
    const entry = await NotificationLog.findById(req.params.logId);
    if (!entry) return res.status(404).json({ success: false, message: 'Log entry not found' });
    const branchId = entry.branch;
    const settings = await notificationService.ensureSettings(branchId, req.userId);
    const to = req.body.to || entry.to;
    let result;
    if (entry.channel === 'email') {
      result = await notificationService.sendEmail(
        { ...settings.toObject(), email: { ...(settings.email || {}), enabled: true } },
        { to, subject: entry.subject, bodyText: entry.message, vars: { businessName: (settings.email && settings.email.fromName) || '' } }
      );
    } else {
      result = await notificationService.sendWhatsapp(
        settings.toObject(),
        { to, message: entry.message }
      );
    }
    await NotificationLog.create({ branch: branchId, sale: entry.sale, invoiceNo: entry.invoiceNo, channel: entry.channel, to, subject: entry.subject, message: entry.message, provider: entry.provider, status: result.status, error: result.error, meta: { resendOf: entry._id } });
    res.json({ success: result.status === 'sent', data: result });
  } catch (err) {
    next(err);
  }
});

/** Preview a rendered template with sample/real sale data (no sending). */
router.get('/preview', async (req, res, next) => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) return res.status(400).json({ success: false, message: 'Branch is required' });
    const settings = await notificationService.ensureSettings(branchId, req.userId);
    const branch = await Branch.findById(branchId).lean();
    const Setting = require('../models/Setting');
    const businessSettings = await Setting.findOne({ key: 'business' }).lean();
    const sample = {
      businessName: businessSettings?.businessName,
      invoiceNo: req.query.invoiceNo || 'SAMPLE-0001',
      date: new Date().toISOString(),
      customerName: req.query.customerName || 'Sample Customer',
      customerMobile: '9999999999',
      items: [
        { name: 'Sample Item A', qty: 2, total: 200, price: 100 },
        { name: 'Sample Item B', qty: 1, total: 149.5, price: 149.5 },
      ],
      subtotal: 349.5, discount: 0, gstTotal: 17.48, total: 366.98, paymentMode: 'cash',
    };
    const vars = notificationService.buildVars({ sale: sample, invoice: sample, branch, businessSettings });
    res.json({
      success: true,
      data: {
        vars,
        emailSubject: notificationService.renderTemplate(settings.template.emailSubject, vars),
        emailBody: notificationService.renderTemplate(settings.template.emailBody, vars),
        whatsappBody: notificationService.renderTemplate(settings.template.whatsappBody, vars),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
