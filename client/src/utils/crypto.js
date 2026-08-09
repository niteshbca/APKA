/* WebCrypto helpers for license signature verification in the browser.
 * Uses the same canonical JSON serialization as the server so that
 * JSON.stringify(payload) matches on both sides.
 */

import { LICENSE_PUBLIC_KEY } from './licensePublicKey';

function pemToDer(pem) {
  const b64 = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let cachedKey = null;
let cachedPem = '';

async function getPublicKey(pem) {
  if (cachedKey && cachedPem === pem) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    'spki',
    pemToDer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  cachedPem = pem;
  return cachedKey;
}

export function embeddedPublicKey() {
  return LICENSE_PUBLIC_KEY || null;
}

/**
 * Verifies payload JSON against a base64 RSA-SHA256 signature.
 * payloadObj must be the exact same object shape (same key order) the server signed.
 */
export async function verifySignedPayload(payloadObj, signature, publicKeyPem) {
  if (!payloadObj || !signature || !publicKeyPem) return false;
  try {
    const key = await getPublicKey(publicKeyPem);
    const data = new TextEncoder().encode(JSON.stringify(payloadObj));
    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBytes, data);
  } catch (err) {
    console.error('Signature verification failed:', err);
    return false;
  }
}

/**
 * Rebuilds the canonical signed payload from the fields stored locally.
 * ORDER MUST MATCH server licenseService.buildSignedPayload.
 */
export function buildSignedPayloadFromLicense(l) {
  return {
    licenseId: l.licenseId,
    customerName: l.customerName,
    businessName: l.businessName,
    startDate: l.startDate,
    expiryDate: l.expiryDate,
    status: l.status,
    maxDevices: l.maxDevices,
    issuedAt: l.issuedAt,
  };
}
