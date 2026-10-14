import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

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
    <div className="dl-page">
      <div className="dl-bg" aria-hidden="true">
        <span className="lg-grid" />
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
      </div>

      <div className="dl-inner">
        <header className="dl-head">
          <div className="dl-brand">
            <span className="brand-mark">🛒</span>
            <div>
              <div className="brand-name">NiteshPro <span>POS</span></div>
              <div className="brand-auth">Authorized POS System</div>
            </div>
          </div>
          <Link className="btn dl-back" to="/login">← Back to Sign In</Link>
        </header>

        <div className="dl-hero">
          <h1>Get NiteshPro on every device</h1>
          <p className="dl-sub">Install the app — works fully offline and syncs automatically when you're back online.</p>
          <div className="dl-chips">
            <span className="dl-chip">📴 Offline Ready</span>
            <span className="dl-chip">☁️ Cloud Sync</span>
            <span className="dl-chip">🔒 Encrypted</span>
            <span className="dl-chip">⚡ Fast Billing</span>
          </div>
        </div>

        <div className="dl-grid">
          <section className="dl-card">
            <div className="dl-card-head">
              <span className="dl-os">💻</span>
              <div>
                <h3>Desktop App</h3>
                <span className="dl-os-sub">Windows · macOS · Linux</span>
              </div>
              <span className="dl-badge">Recommended</span>
            </div>
            <p className="muted small">
              Full POS software for your counter — billing, products, purchases and reports, all working offline.
            </p>

            <div className="mk-pos" aria-hidden="true">
              <div className="mk-bar">
                <span className="mk-dot r" />
                <span className="mk-dot y" />
                <span className="mk-dot g" />
                <span className="mk-title">NiteshPro POS — Billing</span>
              </div>
              <div className="mk-main">
                <div className="mk-nav">
                  <span className="on">🧾</span>
                  <span>📦</span>
                  <span>📊</span>
                  <span>⚙️</span>
                </div>
                <div className="mk-center">
                  <span className="mk-search" />
                  <div className="mk-tiles">
                    {Array.from({ length: 8 }).map((_, i) => <span key={i} className="mk-tile" />)}
                  </div>
                </div>
                <div className="mk-cart">
                  <span className="mk-line" />
                  <span className="mk-line" />
                  <span className="mk-line s" />
                  <span className="mk-total" />
                </div>
              </div>
            </div>

            <Button className="btn-block dl-btn" onClick={downloadDesktop}>
              ⬇️ Download Desktop App
            </Button>
            {desktopNotice && !DESKTOP_URL && (
              <div className="muted small mt-8" style={{ color: '#fca5a5' }}>
                Installer link abhi configure nahi hua. Admin se poocho, ya GitHub Release me exe upload karke
                Netlify me <code>VITE_DESKTOP_URL</code> set karke redeploy karo.
              </div>
            )}
          </section>

          <section className="dl-card">
            <div className="dl-card-head">
              <span className="dl-os">📱</span>
              <div>
                <h3>Mobile App</h3>
                <span className="dl-os-sub">Android · iPhone (PWA)</span>
              </div>
            </div>
            <p className="muted small">
              Apne phone par install karo — billing on the go, offline support ke saath.
            </p>

            <div className="phone-mock" aria-hidden="true">
              <span className="phone-notch" />
              <div className="phone-screen">
                <span className="phone-appicon">🛒</span>
                <b className="phone-appname">NiteshPro</b>
                <span className="phone-sub">POS</span>
                <div className="phone-rows">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>

            <Button className="btn-block dl-btn" onClick={downloadApk}>
              ⬇️ Download APK (Android)
            </Button>
            {apkNotice && !APK_URL && (
              <div className="muted small mt-8" style={{ color: '#fca5a5' }}>
                APK link abhi configure nahi hua. Admin se poocho, ya Netlify me <code>VITE_APK_URL</code> set karke redeploy karo.
              </div>
            )}
            <Button
              variant="ghost"
              className="btn-block dl-btn-ghost mt-8"
              onClick={() => window.open(APP_URL, '_blank')}
              disabled={!APP_URL}
            >
              🌐 Add to Home Screen (PWA)
            </Button>
          </section>
        </div>

        <section className="dl-steps">
          <h4>📱 Install Mobile App — Steps</h4>
          <ol>
            <li><b>Android (APK):</b> tap <b>"Download APK (Android)"</b> → APK download karo → open karo → "Install unknown apps" allow → Install.</li>
            <li><b>Android (Chrome):</b> <b>"Add to Home Screen"</b> dabao → ⋮ menu → <b>"Install app"</b> / <b>"Add to Home screen"</b>.</li>
            <li><b>iPhone (Safari):</b> <b>"Add to Home Screen"</b> dabao → <b>Share</b> button → <b>"Add to Home Screen"</b>.</li>
            <li>The app appears as a normal app icon. <b>First time open it while online</b> (loads the app + your data).</li>
            <li>After that it works <b>offline</b> — new sales/entries save on the phone and auto-sync when internet returns.</li>
          </ol>
        </section>

        <div className="dl-foot">NiteshPro POS · Authorized Retail Platform · © {new Date().getFullYear()}</div>
      </div>
    </div>
  );
}
