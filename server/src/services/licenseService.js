const License = require('../models/License');
const Device = require('../models/Device');
const keyService = require('./keyService');

function generateLicenseId() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let alpha = '';
  for (let i = 0; i < 4; i += 1) alpha += chars[Math.floor(Math.random() * chars.length)];
  return `NP-${digits}-${alpha}`;
}

/**
 * Normalizes a user-entered license id so lookups are tolerant of case,
 * surrounding/inner whitespace, missing/extra hyphens and invisible
 * characters (zero-width spaces etc). All stored ids are canonical "NP-XXXX-XXXX".
 */
function canonicalLicenseId(raw) {
  const norm = String(raw == null ? '' : raw).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (/^NP\d{4}[A-Z0-9]{4}$/.test(norm)) return `NP-${norm.slice(2, 6)}-${norm.slice(6, 10)}`;
  return String(raw == null ? '' : raw).trim().toUpperCase();
}

async function findLicenseById(rawId) {
  const canonical = canonicalLicenseId(rawId);
  if (!canonical) return null;
  let license = await License.findOne({ licenseId: canonical });
  if (!license) {
    // Fallback: case-insensitive match (covers any legacy/non-canonical stored ids).
    const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    license = await License.findOne({ licenseId: { $regex: `^${escaped}$`, $options: 'i' } });
  }
  return license;
}

/**
 * The canonical payload that is digitally signed.
 * Field ORDER is critical - the client must rebuild the payload in exactly
 * this order and verify with the same JSON.stringify output.
 */
function buildSignedPayload(license) {
  return {
    licenseId: license.licenseId,
    customerName: license.customerName,
    businessName: license.businessName,
    startDate: license.startDate instanceof Date ? license.startDate.toISOString() : license.startDate,
    expiryDate: license.expiryDate instanceof Date ? license.expiryDate.toISOString() : license.expiryDate,
    status: license.status,
    maxDevices: license.maxDevices,
    issuedAt: license.issuedAt instanceof Date ? license.issuedAt.toISOString() : license.issuedAt,
  };
}

async function signLicense(license) {
  const payload = buildSignedPayload(license);
  license.signature = keyService.signPayload(payload);
  license.lastValidatedAt = new Date();
  await license.save();
  return { payload, signature: license.signature };
}

function verifySignedPayload(payload, signature) {
  return keyService.verifyPayload(payload, signature, keyService.publicKeyPem());
}

async function getLicenseByPayload(payload) {
  return findLicenseById(payload.licenseId);
}

async function validateOnline(licenseId, deviceId) {
  const license = await findLicenseById(licenseId);
  if (!license) return { valid: false, reason: 'LICENSE_NOT_FOUND' };

  const now = new Date();
  if (license.status === 'expired' || new Date(license.expiryDate) < now) {
    if (license.status !== 'expired') {
      license.status = 'expired';
      await license.save();
    }
    return { valid: false, reason: 'LICENSE_EXPIRED', expiryDate: license.expiryDate };
  }
  if (license.status === 'suspended') return { valid: false, reason: 'LICENSE_SUSPENDED' };
  if (license.status === 'inactive') return { valid: false, reason: 'LICENSE_INACTIVE' };

  let device = null;
  if (deviceId) {
    device = await Device.findOne({ deviceId, licenseId });
    if (device && !device.active) return { valid: false, reason: 'DEVICE_BLOCKED' };
    if (!device) {
      return { valid: false, reason: 'DEVICE_NOT_BOUND', deviceId };
    }
    device.lastSeenAt = now;
    await device.save();
  }

  license.lastValidatedAt = now;
  await license.save();

  return {
    valid: true,
    license: buildSignedPayload(license),
    signature: license.signature,
    serverTime: now,
    deviceId,
  };
}

async function bindDevice(licenseId, deviceId, deviceName, platform) {
  const license = await findLicenseById(licenseId);
  if (!license) return { ok: false, reason: 'LICENSE_NOT_FOUND', receivedLicenseId: licenseId };
  const now = new Date();
  if (new Date(license.expiryDate) < now || license.status === 'expired') {
    if (license.status !== 'expired') {
      license.status = 'expired';
      await license.save();
    }
    return { ok: false, reason: 'LICENSE_EXPIRED' };
  }
  if (license.status !== 'active') return { ok: false, reason: 'LICENSE_' + license.status.toUpperCase() };

  let device = await Device.findOne({ deviceId });
  if (device) {
    if (device.licenseId && device.licenseId !== license.licenseId) {
      return { ok: false, reason: 'DEVICE_BOUND_TO_ANOTHER_LICENSE' };
    }
    device.licenseId = license.licenseId;
    device.name = deviceName || device.name;
    device.platform = platform || device.platform;
    device.active = true;
    device.lastSeenAt = now;
    await device.save();
  } else {
    const boundCount = await Device.countDocuments({ licenseId: license.licenseId, active: true });
    if (boundCount >= license.maxDevices) {
      return { ok: false, reason: 'MAX_DEVICES_REACHED', maxDevices: license.maxDevices };
    }
    device = await Device.create({
      deviceId,
      licenseId,
      name: deviceName || 'Unknown device',
      platform: platform || 'unknown',
      active: true,
      lastSeenAt: now,
    });
  }

  const payload = buildSignedPayload(license);
  return { ok: true, license: payload, signature: license.signature, serverTime: now, deviceId };
}

module.exports = {
  generateLicenseId,
  canonicalLicenseId,
  findLicenseById,
  buildSignedPayload,
  signLicense,
  verifySignedPayload,
  validateOnline,
  bindDevice,
  getLicenseByPayload,
};
