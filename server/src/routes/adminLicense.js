const express = require('express');
const License = require('../models/License');
const Device = require('../models/Device');
const licenseService = require('../services/licenseService');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, requireRoles('superadmin'));

router.get('/', async (req, res, next) => {
  try {
    const licenses = await License.find().sort({ createdAt: -1 });
    const devices = await Device.find().lean();
    const withDevices = licenses.map((l) => ({
      ...l.toObject(),
      devices: devices.filter((d) => d.licenseId === l.licenseId),
    }));
    res.json({ success: true, data: withDevices });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { customerName, businessName, startDate, expiryDate, maxDevices, note } = req.body;
    if (!customerName || !businessName || !expiryDate) {
      return res.status(400).json({ success: false, message: 'customerName, businessName and expiryDate are required' });
    }
    const license = await License.create({
      licenseId: licenseService.generateLicenseId(),
      customerName,
      businessName,
      startDate: startDate ? new Date(startDate) : new Date(),
      expiryDate: new Date(expiryDate),
      maxDevices: maxDevices || 1,
      note: note || '',
    });
    const { payload, signature } = await licenseService.signLicense(license);
    res.status(201).json({ success: true, data: { ...license.toObject(), payload, signature } });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/renew', async (req, res, next) => {
  try {
    const { expiryDate } = req.body;
    if (!expiryDate) return res.status(400).json({ success: false, message: 'expiryDate is required' });
    const license = await License.findById(req.params.id);
    if (!license) return res.status(404).json({ success: false, message: 'License not found' });
    license.expiryDate = new Date(expiryDate);
    license.status = 'active';
    const { payload, signature } = await licenseService.signLicense(license);
    res.json({ success: true, data: { ...license.toObject(), payload, signature } });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/suspend', async (req, res, next) => {
  try {
    const license = await License.findById(req.params.id);
    if (!license) return res.status(404).json({ success: false, message: 'License not found' });
    license.status = 'suspended';
    await licenseService.signLicense(license);
    res.json({ success: true, data: license });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/activate', async (req, res, next) => {
  try {
    const license = await License.findById(req.params.id);
    if (!license) return res.status(404).json({ success: false, message: 'License not found' });
    license.status = new Date(license.expiryDate) < new Date() ? 'expired' : 'active';
    await licenseService.signLicense(license);
    res.json({ success: true, data: license });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/max-devices', async (req, res, next) => {
  try {
    const { maxDevices } = req.body;
    const license = await License.findById(req.params.id);
    if (!license) return res.status(404).json({ success: false, message: 'License not found' });
    if (!maxDevices || maxDevices < 1) return res.status(400).json({ success: false, message: 'maxDevices must be >= 1' });
    license.maxDevices = maxDevices;
    await licenseService.signLicense(license);
    res.json({ success: true, data: license });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await License.findByIdAndDelete(req.params.id);
    await Device.updateMany({ licenseId: req.params.licenseId }, { licenseId: null });
    res.json({ success: true, message: 'License deleted' });
  } catch (err) {
    next(err);
  }
});

router.get('/devices', async (req, res, next) => {
  try {
    const devices = await Device.find().sort({ createdAt: -1 });
    res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
});

router.post('/devices/:deviceId/block', async (req, res, next) => {
  try {
    const device = await Device.findOneAndUpdate({ deviceId: req.params.deviceId }, { active: false }, { new: true });
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });
    res.json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
});

router.post('/devices/:deviceId/allow', async (req, res, next) => {
  try {
    const device = await Device.findOneAndUpdate({ deviceId: req.params.deviceId }, { active: true }, { new: true });
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });
    res.json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
