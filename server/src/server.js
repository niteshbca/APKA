require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const branchRoutes = require('./routes/branches');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const saleRoutes = require('./routes/sales');
const invoiceRoutes = require('./routes/invoices');
const purchaseRoutes = require('./routes/purchases');
const stockRoutes = require('./routes/stock');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const licenseRoutes = require('./routes/license');
const adminLicenseRoutes = require('./routes/adminLicense');
const deviceRoutes = require('./routes/devices');
const syncRoutes = require('./routes/sync');
const settingRoutes = require('./routes/settings');
const cloudSyncRoutes = require('./routes/cloudSync');
const cloudSyncWorker = require('./services/cloudSyncWorker');
const keyService = require('./services/keyService');
const licenseService = require('./services/licenseService');

const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '25mb' }));

// Health reports both API availability AND whether the online database
// (MongoDB) is reachable. The client treats db:false as OFFLINE so it keeps
// billing locally in IndexedDB (important for the desktop app in offices
// without internet — the app must still open and work).
app.get('/api/health', (req, res) => {
  const dbReady = mongoose.connection && mongoose.connection.readyState === 1;
  res.json({
    success: true,
    status: 'ok',
    db: dbReady,
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/admin/license', adminLicenseRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/cloud', cloudSyncRoutes);

// Desktop installer download (served from server/public/installer).
const INSTALLER_DIR = path.join(__dirname, '..', 'public', 'installer');
if (fs.existsSync(INSTALLER_DIR)) {
  app.use('/installer', express.static(INSTALLER_DIR));
}

// Production: serve the built React app (client/dist) as static files.
// Must be registered before the 404 handler.
const CLIENT_DIST = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

async function start() {
  // MongoDB is the ONLINE store. If it is unreachable (no internet / office
  // firewall), the API still starts so the static PWA + local IndexedDB keep
  // billing working. Once the DB reconnects the sync engine resumes normally.
  try {
    await connectDB();
  } catch (err) {
    console.error('[db] MongoDB unreachable — starting in OFFLINE mode:', err.message);
  }

  // Keep every stored license signature in sync with the current signing key.
  // Important on hosted deployments where the private key comes from an env var
  // and the database may contain licenses signed by an older key.
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    if (keyService.hasPrivateKey()) {
      try {
        const r = await licenseService.resignAllLicenses();
        console.log(`[license] re-signed licenses: ${r.updated}/${r.total} updated`);
      } catch (err) {
        console.error('[license] re-sign failed:', err.message);
      }
    } else {
      console.warn('[license] no private key configured — license activation will use stored signatures only');
    }
  }

  const port = process.env.PORT || 5000;
  const server = app.listen(port, () => console.log(`POS API server running on http://localhost:${port}`));
  if (cloudSyncWorker.isEnabled()) {
    cloudSyncWorker.start();
    console.log('[cloud-sync] background sync worker started');
  } else {
    console.log('[cloud-sync] disabled (set CLOUD_SYNC_URL + CLOUD_SYNC_TOKEN to enable)');
  }
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = { app, start };
