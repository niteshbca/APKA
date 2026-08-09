const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = path.resolve(__dirname, '..', '..', process.env.LICENSE_KEYS_DIR || 'keys');

function loadPrivateKey() {
  const p = path.join(KEYS_DIR, 'private.pem');
  if (!fs.existsSync(p)) throw new Error('License private key missing. Run: npm run setup (server)');
  return fs.readFileSync(p, 'utf8');
}

function loadPublicKey() {
  const p = path.join(KEYS_DIR, 'public.pem');
  if (!fs.existsSync(p)) throw new Error('License public key missing. Run: npm run setup (server)');
  return fs.readFileSync(p, 'utf8');
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

module.exports = { KEYS_DIR, loadPrivateKey, loadPublicKey, publicKeyPem, signPayload, verifyPayload };
