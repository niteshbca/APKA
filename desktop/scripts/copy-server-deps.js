const fs = require('fs');
const path = require('path');

// electron-builder excludes node_modules from extraResources, so we copy the
// server's production dependencies into the packed app after the app dir is
// assembled (before the NSIS installer is built).
exports.default = async function (context) {
  const appDir = context.appOutDir;
  const src = path.join(context.packager.info.appDir, '..', 'server', 'node_modules');
  const dest = path.join(appDir, 'resources', 'server', 'node_modules');
  if (!fs.existsSync(src)) {
    console.log('afterPack: server node_modules not found at', src);
    return;
  }
  if (fs.existsSync(dest)) {
    console.log('afterPack: server node_modules already present');
    return;
  }
  fs.cpSync(src, dest, { recursive: true });
  console.log('afterPack: copied server node_modules ->', dest);
};
