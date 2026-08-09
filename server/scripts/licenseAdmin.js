require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const connectDB = require('../src/config/db');
const License = require('../src/models/License');
const licenseService = require('../src/services/licenseService');

/**
 * CLI license admin:
 *  node scripts/licenseAdmin.js --list
 *  node scripts/licenseAdmin.js --create "Customer Name" "Business Name" 2026-12-31 3
 *  node scripts/licenseAdmin.js --renew <licenseId> 2027-06-30
 *  node scripts/licenseAdmin.js --suspend <licenseId>
 *  node scripts/licenseAdmin.js --activate <licenseId>
 *  node scripts/licenseAdmin.js --expired "Customer" "Business"   (creates an already-expired license for testing)
 */
const args = process.argv.slice(2);

async function main() {
  await connectDB();
  const flag = args[0];

  if (flag === '--list') {
    const licenses = await License.find().sort({ createdAt: -1 });
    for (const l of licenses) {
      console.log(
        `${l.licenseId} | ${l.customerName} | ${l.businessName} | start=${l.startDate.toISOString().slice(0, 10)} | expiry=${l.expiryDate.toISOString().slice(0, 10)} | ${l.status} | devices=${l.maxDevices}`
      );
    }
    process.exit(0);
  }

  if (flag === '--create') {
    const [, customerName, businessName, expiryDate, maxDevices = 1] = args;
    if (!customerName || !businessName || !expiryDate) {
      console.error('Usage: --create "Customer" "Business" YYYY-MM-DD [maxDevices]');
      process.exit(1);
    }
    const license = await License.create({
      licenseId: licenseService.generateLicenseId(),
      customerName,
      businessName,
      startDate: new Date(),
      expiryDate: new Date(expiryDate),
      maxDevices: Number(maxDevices),
    });
    await licenseService.signLicense(license);
    console.log('License created and signed:', license.licenseId, '-> expiry', expiryDate);
    process.exit(0);
  }

  if (flag === '--expired') {
    const [, customerName, businessName] = args;
    if (!customerName || !businessName) {
      console.error('Usage: --expired "Customer" "Business"');
      process.exit(1);
    }
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const license = await License.create({
      licenseId: licenseService.generateLicenseId(),
      customerName,
      businessName,
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      expiryDate: yesterday,
      maxDevices: 1,
    });
    license.status = 'expired';
    await licenseService.signLicense(license);
    console.log('EXPIRED license created for testing:', license.licenseId, '-> expiry', yesterday.toISOString().slice(0, 10));
    process.exit(0);
  }

  if (flag === '--renew') {
    const [, licenseId, expiryDate] = args;
    if (!licenseId || !expiryDate) {
      console.error('Usage: --renew <licenseId> YYYY-MM-DD');
      process.exit(1);
    }
    const license = await License.findOne({ licenseId });
    if (!license) {
      console.error('License not found:', licenseId);
      process.exit(1);
    }
    license.expiryDate = new Date(expiryDate);
    license.status = 'active';
    await licenseService.signLicense(license);
    console.log('License renewed:', licenseId, '->', expiryDate);
    process.exit(0);
  }

  if (flag === '--suspend' || flag === '--activate') {
    const licenseId = args[1];
    if (!licenseId) {
      console.error(`Usage: ${flag} <licenseId>`);
      process.exit(1);
    }
    const license = await License.findOne({ licenseId });
    if (!license) {
      console.error('License not found:', licenseId);
      process.exit(1);
    }
    license.status = flag === '--suspend' ? 'suspended' : 'active';
    await licenseService.signLicense(license);
    console.log('License status set to:', license.status);
    process.exit(0);
  }

  console.error('Unknown command:', flag);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
