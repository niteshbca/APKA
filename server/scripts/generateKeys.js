require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = path.resolve(__dirname, '..', process.env.LICENSE_KEYS_DIR || 'keys');
const PRIVATE = path.join(KEYS_DIR, 'private.pem');
const PUBLIC = path.join(KEYS_DIR, 'public.pem');
const CLIENT_KEY_FILE = path.resolve(__dirname, '..', '..', 'client', 'src', 'utils', 'licensePublicKey.js');

function generate() {
  if (fs.existsSync(PRIVATE)) {
    console.log('Key pair already exists. Delete', PRIVATE, 'and', PUBLIC, 'to regenerate.');
    return;
  }
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  fs.writeFileSync(PRIVATE, privateKey, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(PUBLIC, publicKey, { encoding: 'utf8', mode: 0o644 });
  console.log('License key pair generated at', KEYS_DIR);

  // Copy the public key into the client so offline signature verification works
  // without network access (anti-bypass / offline-first).
  const clientDir = path.dirname(CLIENT_KEY_FILE);
  fs.mkdirSync(clientDir, { recursive: true });
  const pem = publicKey.replace(/\r?\n/g, '\\n');
  const content = `// GENERATED FILE - do not edit manually. Run "npm run keys" (server) to regenerate.\nexport const LICENSE_PUBLIC_KEY = "${pem}";\n`;
  fs.writeFileSync(CLIENT_KEY_FILE, content, { encoding: 'utf8' });
  console.log('Public key copied to client at', CLIENT_KEY_FILE);
}

generate();
