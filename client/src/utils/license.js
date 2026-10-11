/* Client-side license manager.
 * - Loads/saves the signed license + last-validation state in IndexedDB.
 * - Verifies the RSA signature offline using the embedded public key.
 * - Detects expiry offline, with clock-tamper protection using a stored
 *   server-time offset captured during the last online validation.
 */

import db from '../db';
import { embeddedPublicKey, verifySignedPayload, buildSignedPayloadFromLicense } from './crypto';
import { uid } from './format';

export const LICENSE_STATES = {
  LOADING: 'LOADING',
  VALID: 'VALID',
  NOT_ACTIVATED: 'NOT_ACTIVATED',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  DEVICE_NOT_BOUND: 'DEVICE_NOT_BOUND',
  CORRUPTED: 'CORRUPTED',
};

async function getLicense() {
  return db.get('settings', 'license');
}

export async function saveLicense(license) {
  await db.put('settings', { key: 'license', ...license });
}

export async function clearLicense() {
  await db.delete('settings', 'license');
  await db.delete('settings', 'license_state');
}

export async function getDeviceId() {
  let device = await db.get('settings', 'device');
  if (!device || !device.deviceId) {
    device = { key: 'device', deviceId: uid('DEV'), createdAt: new Date().toISOString() };
    await db.put('settings', device);
  }
  return device.deviceId;
}

/**
 * Effective "server time" = local time + stored offset (clock-tamper protection).
 * The offset is the difference between the server clock and the device clock at
 * the moment of the last successful online validation.
 */
export async function getTimeOffsetMs() {
  const state = await db.get('settings', 'license_state');
  if (state && typeof state.offsetMs === 'number') return state.offsetMs;
  return 0;
}

export async function getServerTime() {
  return Date.now() + (await getTimeOffsetMs());
}

export async function saveValidationState({ valid, serverTime, reason }) {
  const offsetMs = serverTime ? new Date(serverTime).getTime() - Date.now() : await getTimeOffsetMs();
  await db.put('settings', {
    key: 'license_state',
    lastValidatedAt: new Date().toISOString(),
    lastServerTime: serverTime ? new Date(serverTime).toISOString() : null,
    offsetMs,
    valid: !!valid,
    reason: reason || '',
  });
}

export async function savePublicKey(publicKey) {
  if (!publicKey) return;
  await db.put('settings', { key: 'license_public_key', publicKey, fetchedAt: new Date().toISOString() });
}

async function candidatePublicKeys() {
  const keys = [];
  const cached = await db.get('settings', 'license_public_key');
  if (cached && cached.publicKey) keys.push(cached.publicKey);
  const embedded = embeddedPublicKey();
  if (embedded && !keys.includes(embedded)) keys.push(embedded);
  return keys;
}

async function resolvePublicKey() {
  const keys = await candidatePublicKeys();
  return keys[0] || null;
}

/**
 * Full local license check (works fully offline).
 */
export async function checkLicense() {
  const license = await getLicense();
  if (!license) return { state: LICENSE_STATES.NOT_ACTIVATED, license: null, reason: 'NOT_ACTIVATED' };

  if (!license.signature || !license.payload) {
    return { state: LICENSE_STATES.CORRUPTED, license, reason: 'CORRUPTED' };
  }

  const publicKey = await resolvePublicKey();
  if (!publicKey) {
    return { state: LICENSE_STATES.CORRUPTED, license, reason: 'NO_PUBLIC_KEY' };
  }

  // 1. Verify cryptographic signature (anti-tamper of expiry date / status).
  // Try every candidate key (cached + embedded) so a vendor key rotation never
  // permanently locks the device out.
  const keys = await candidatePublicKeys();
  if (keys.length === 0) {
    return { state: LICENSE_STATES.CORRUPTED, license, reason: 'NO_PUBLIC_KEY' };
  }
  let ok = false;
  for (const k of keys) {
    // eslint-disable-next-line no-await-in-loop
    if (await verifySignedPayload(license.payload, license.signature, k)) {
      ok = true;
      break;
    }
  }
  if (!ok) return { state: LICENSE_STATES.INVALID_SIGNATURE, license, reason: 'INVALID_SIGNATURE' };

  const payload = license.payload;

  // 2. Status must be active.
  if (payload.status !== 'active') {
    return { state: LICENSE_STATES.SUSPENDED, license, reason: 'SUSPENDED' };
  }

  // 3. Check expiry against server-adjusted time.
  const now = new Date(await getServerTime());
  const expiry = new Date(payload.expiryDate);
  const start = new Date(payload.startDate);
  if (now < start) return { state: LICENSE_STATES.EXPIRED, license, reason: 'NOT_YET_STARTED' };
  if (expiry < now) return { state: LICENSE_STATES.EXPIRED, license, reason: 'EXPIRED' };

  // 4. Device binding.
  const deviceId = await getDeviceId();
  if (payload.deviceId && payload.deviceId !== deviceId) {
    return { state: LICENSE_STATES.DEVICE_NOT_BOUND, license, reason: 'DEVICE_NOT_BOUND' };
  }
  if (license.boundDeviceId && license.boundDeviceId !== deviceId) {
    return { state: LICENSE_STATES.DEVICE_NOT_BOUND, license, reason: 'DEVICE_NOT_BOUND' };
  }

  return { state: LICENSE_STATES.VALID, license, reason: 'VALID', effectiveNow: now, expiry };
}

export async function getLicenseStatus() {
  return getLicense();
}

export { buildSignedPayloadFromLicense, embeddedPublicKey };
