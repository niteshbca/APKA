const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = path.resolve(__dirname, '..', '..', process.env.LICENSE_KEYS_DIR || 'keys');

/**
 * Normalizes a key supplied via an environment variable. Accepts:
 *  - a raw PEM string,
 *  - a PEM with escaped "\n" sequences (common when pasted into dashboards),
 *  - a base64-encoded PEM.
 */
function normalizePem(value) {
  let v = String(value == null ? '' : value).trim();
  if (!v) return '';
  if (v.includes('\\n')) v = v.replace(/\\n/g, '\n');
  if (!v.includes('BEGIN')) {
    try {
      const decoded = Buffer.from(v, 'base64').toString('utf8');
      if (decoded.includes('BEGIN')) v = decoded;
    } catch (e) {
      /* not base64 - ignore */
    }
  }
  return v.trim();
}

function loadPrivateKey() {
  const fromEnv = normalizePem(process.env.LICENSE_PRIVATE_KEY);
  if (fromEnv) return fromEnv;
  const p = path.join(KEYS_DIR, 'private.pem');
  if (!fs.existsSync(p)) throw new Error('License private key missing. Set LICENSE_PRIVATE_KEY env var (or run: npm run keys).');
  return fs.readFileSync(p, 'utf8');
}

function loadPublicKey() {
  const fromEnv = normalizePem(process.env.LICENSE_PUBLIC_KEY);
  if (fromEnv) return fromEnv;
  const p = path.join(KEYS_DIR, 'public.pem');
  if (!fs.existsSync(p)) throw new Error('License public key missing. Set LICENSE_PUBLIC_KEY env var (or deploy server/keys/public.pem).');
  return fs.readFileSync(p, 'utf8');
}

function hasPrivateKey() {
  try {
    return !!loadPrivateKey();
  } catch (e) {
    return false;
  }
}

function publicKeyPem() {
  return loadPublicKey();
}

/**
 * Signs an object payload (JSON.stringify must be deterministic).
 */
function signPayload(payload) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(JSON.stringify(payload));
  signer.end();
  return signer.sign(loadPrivateKey(), 'base64');
}

/**
 * Verifies a payload against a signature + public key PEM.
 */
function verifyPayload(payload, signature, publicKeyPemString) {
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(JSON.stringify(payload));
    verifier.end();
    return verifier.verify(publicKeyPemString, signature, 'base64');
  } catch (err) {
    return false;
  }
}

module.exports = { KEYS_DIR, loadPrivateKey, loadPublicKey, hasPrivateKey, publicKeyPem, signPayload, verifyPayload };
