require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const { spawnSync } = require('child_process');

console.log('=== POS setup ===');
console.log('1. Generating license RSA key pair...');
let r = spawnSync(process.execPath, [path.join(__dirname, 'generateKeys.js')], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);

console.log('2. Seeding admin user...');
r = spawnSync(process.execPath, [path.join(__dirname, 'seedAdmin.js')], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);

console.log('\nSetup complete.');
console.log('Next steps:');
console.log('  npm run dev            # start server + client');
console.log('  npm run license --prefix server -- --list   # manage licenses');
