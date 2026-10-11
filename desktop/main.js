const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

const isDev = !app.isPackaged;
const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SMOKE = process.argv.includes('--smoke');

let mainWindow = null;
let httpServer = null;

function resolveServerMain() {
  if (isDev) return path.join(__dirname, '..', 'server', 'src', 'server.js');
  return path.join(process.resourcesPath, 'server', 'src', 'server.js');
}

function checkHealth(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Starts the bundled Express backend. The server now starts even when MongoDB
 * Atlas is unreachable (offline mode) — the POS keeps billing locally in
 * IndexedDB and syncs automatically once the internet / database returns.
 * So this should never hard-fail the desktop app.
 */
async function startBackend() {
  if (await checkHealth()) return true;
  try {
    const serverModule = require(resolveServerMain());
    httpServer = await serverModule.start();
    return true;
  } catch (err) {
    console.error('Backend failed to start:', err);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'NiteshPro POS',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadURL(BASE_URL);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const ok = await startBackend();
    if (SMOKE) {
      console.log(ok ? 'SMOKE_OK' : 'SMOKE_FAIL');
      app.exit(ok ? 0 : 1);
      return;
    }
    // Always open the window. Even if the online database is unreachable the
    // app runs in OFFLINE mode (local IndexedDB) instead of refusing to start.
    createWindow();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', () => {
    if (httpServer) {
      try {
        httpServer.close();
      } catch (e) {
        /* ignore */
      }
    }
  });
}

