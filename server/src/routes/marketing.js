const express = require('express');
const Customer = require('../models/Customer');
const Campaign = require('../models/Campaign');
const notificationService = require('../services/notificationService');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');
const audit = require('../services/auditService');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('marketing'));

const view = requirePermission('marketing.view', 'settings.view');
const send = requirePermission('marketing.send', 'settings.edit');

router.get('/audience', view, async (req, res, next) => {
  try {
    const customers = await Customer.find({}).sort({ name: 1 }).limit(2000);
    res.json({
      success: true,
      data: customers.map((c) => ({ _id: c._id, name: c.name, mobile: c.mobile || '', email: c.email || '' })),
    });
  } catch (err) { next(err); }
});

router.get('/campaigns', view, async (req, res, next) => {
  try {
    const data = await Campaign.find({}).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/campaign', send, async (req, res, next) => {
  try {
    const { channel = 'email', subject = '', message = '', sendTo = 'all', customerIds = [], name = '' } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message is required' });
    if (!['email', 'whatsapp'].includes(channel)) return res.status(400).json({ success: false, message: 'channel must be email or whatsapp' });

    const query = Array.isArray(customerIds) && customerIds.length && sendTo !== 'all' ? { _id: { $in: customerIds } } : {};
    const customers = await Customer.find(query).limit(500);

    const branchId = req.body.branch || req.userBranch;
    const settings = await notificationService.getSettings(branchId);
    if (channel === 'email' && !(settings && settings.email && settings.email.enabled)) {
      return res.status(400).json({ success: false, message: 'Email is not enabled for this branch. Configure it in Notifications first.' });
    }
    if (channel === 'whatsapp' && !(settings && settings.whatsapp && settings.whatsapp.enabled)) {
      return res.status(400).json({ success: false, message: 'WhatsApp is not enabled for this branch. Configure it in Notifications first.' });
    }

    let sentCount = 0;
    let failed = 0;
    for (const c of customers) {
      try {
        if (channel === 'email') {
          if (!c.email) { failed++; continue; }
          const r = await notificationService.sendEmail(settings, { to: c.email, subject: subject || 'Update from us', bodyText: message, vars: { customer: c } });
          if (r && r.status === 'sent') sentCount++; else failed++;
        } else {
          if (!c.mobile) { failed++; continue; }
          const r = await notificationService.sendWhatsapp(settings, { to: c.mobile, message });
          if (r && r.status === 'sent') sentCount++; else failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    const status = sentCount === 0 ? 'failed' : failed > 0 ? 'partial' : 'sent';
    const campaign = await Campaign.create({
      name: name || `${channel} campaign`,
      channel,
      subject,
      body: message,
      recipients: customers.length,
      sent: sentCount,
      failed,
      status,
      branch: branchId || undefined,
      createdBy: req.userId,
    });
    audit.record(req, { action: 'marketing.campaign.send', entity: 'campaign', entityId: campaign._id, meta: { channel, sent: sentCount, failed } });
    res.status(201).json({ success: true, data: campaign });
  } catch (err) { next(err); }
});

module.exports = router;
