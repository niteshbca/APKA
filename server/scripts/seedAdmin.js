require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

async function seed() {
  await connectDB();

  const users = [
    { name: 'System Owner', username: 'owner', password: 'owner123', role: 'superadmin' },
    { name: 'Admin', username: 'admin', password: 'admin123', role: 'admin' },
    { name: 'Cashier', username: 'cashier', password: 'cashier123', role: 'cashier' },
  ];

  for (const u of users) {
    const existing = await User.findOne({ username: u.username });
    if (existing) {
      console.log(`User "${u.username}" already exists - skipping`);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, Number(process.env.BCRYPT_ROUNDS) || 10);
    await User.create({ name: u.name, username: u.username, passwordHash, role: u.role });
    console.log(`Created user "${u.username}" (${u.role}) password: ${u.password}`);
  }

  console.log('\nSeed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
