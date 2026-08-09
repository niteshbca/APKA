import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../components/ui';

const DESKTOP_URL = import.meta.env.VITE_DESKTOP_URL || '';
const APK_URL = import.meta.env.VITE_APK_URL || '';
const APP_URL = typeof window !== 'undefined' ? window.location.origin : '';

export default function Downloads() {
  const [desktopNotice, setDesktopNotice] = useState(false);
  const [apkNotice, setApkNotice] = useState(false);

  const downloadDesktop = () => {
    if (DESKTOP_URL) {
      window.open(DESKTOP_URL, '_blank');
    } else {
      setDesktopNotice(true);
    }
  };

  const downloadApk = () => {
    if (APK_URL) {
      window.open(APK_URL, '_blank');
    } else {
      setApkNotice(true);
    }
  };

  return (
    <div className="login-page">
      <div className="downloads-wrap">
        <h1>🛒 POS Billing Suite</h1>
        <div className="sub" style={{ marginBottom: 20 }}>
          Download the app — works fully offline, syncs automatically when online.
        </div>

        <div className="downloads-grid">
          <Card>
            <div className="download-icon">💻</div>
            <h3>Desktop App (Windows)</h3>
            <p className="muted small">
              Installer for Windows PC. Works without internet — billing, products, purchases all offline, auto-sync later.
            </p>
            <Button className="btn-block" onClick={downloadDesktop}>
              ⬇️ Download Desktop App
            </Button>
            {desktopNotice && !DESKTOP_URL && (
              <div className="muted small mt-8" style={{ color: 'var(--danger)' }}>
                Installer link abhi configure nahi hua. Admin se poocho ya phir GitHub Release bana kar exe upload karo, aur Netlify mein <code>VITE_DESKTOP_URL</code> set karke redeploy karo.
              </div>
            )}
          </Card>

          <Card>
            <div className="download-icon">📱</div>
            <h3>Mobile App (Android / iPhone)</h3>
            <p className="muted small">
              Apne phone par app install karo — 2 tarike:
            </p>
            <Button className="btn-block" onClick={downloadApk}>
              ⬇️ Download APK (Android)
            </Button>
            {apkNotice && !APK_URL && (
              <div className="muted small mt-8" style={{ color: 'var(--danger)' }}>
                APK link abhi configure nahi hua. Admin se poocho ya phir Netlify mein <code>VITE_APK_URL</code> set karke redeploy karo.
              </div>
            )}
            <Button
              className="btn-block btn-outline mt-8"
              onClick={() => window.open(APP_URL, '_blank')}
              disabled={!APP_URL}
            >
              🌐 Open as PWA / Add to Home Screen
            </Button>
            <p className="muted small mt-8">
              <b>APK:</b> Android par direct install — download karo, "Install unknown apps" allow karo. <b>PWA:</b> browser mein kholo → menu mein <b>"Add to Home Screen"</b>. Dono offline chalte hain.
            </p>
          </Card>
        </div>

        <Card className="mt-16">
          <h4 style={{ marginBottom: 8 }}>📱 Install Mobile App — Steps</h4>
          <ol className="small" style={{ paddingLeft: 20, lineHeight: 1.9 }}>
            <li><b>Android (APK):</b> tap <b>"Download APK (Android)"</b> → APK download karo → open karo → "Install unknown apps" allow → Install.</li>
            <li><b>Android (Chrome):</b> <b>"Open as PWA"</b> dabao → ⋮ menu → <b>"Add to Home screen"</b> ya <b>"Install app"</b>.</li>
            <li><b>iPhone (Safari):</b> <b>"Open as PWA"</b> dabao → <b>Share</b> button → <b>"Add to Home Screen"</b>.</li>
            <li>The app appears as a normal app icon. <b>First time open it while online</b> (loads the app + your data).</li>
            <li>After that it works <b>offline</b> — new sales/entries are saved on the phone and auto-sync when internet returns.</li>
          </ol>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link className="btn btn-outline" to="/login">← Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
