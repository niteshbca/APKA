import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui';

// Floating billing/inventory icons that drift up behind the login card.
const FLOATERS = [
  { icon: '🧾', left: '6%', size: 54, delay: 0, dur: 16 },
  { icon: '📦', left: '16%', size: 50, delay: 3, dur: 19 },
  { icon: '🛒', left: '25%', size: 46, delay: 6, dur: 15 },
  { icon: '🏷️', left: '34%', size: 48, delay: 1.5, dur: 20 },
  { icon: '💰', left: '44%', size: 52, delay: 8, dur: 17 },
  { icon: '📊', left: '53%', size: 50, delay: 4.5, dur: 21 },
  { icon: '🧾', left: '62%', size: 46, delay: 10, dur: 16 },
  { icon: '📦', left: '71%', size: 54, delay: 2, dur: 18 },
  { icon: '💳', left: '80%', size: 48, delay: 7, dur: 20 },
  { icon: '🛒', left: '89%', size: 50, delay: 5, dur: 15 },
  { icon: '🏷️', left: '11%', size: 44, delay: 11, dur: 22 },
  { icon: '📈', left: '67%', size: 44, delay: 12, dur: 23 },
];

export default function Login() {
  const { login, loginPin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast('Login successful', 'success');
      navigate('/');
    } catch (err) {
      toast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitPin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginPin(pin);
      toast('Login successful', 'success');
      navigate('/');
    } catch (err) {
      toast(err.message || 'Invalid PIN', 'error');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const pressPin = (d) => setPin((p) => (p + d).slice(0, 6));

  return (
    <div className="login-page login-premium">
      <div className="login-bg" aria-hidden="true">
        <span className="lg-grid" />
        <span className="lg-scan" />
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            className="lg-item"
            style={{
              left: f.left,
              width: f.size,
              height: f.size,
              fontSize: f.size * 0.5,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.dur}s`,
            }}
          >
            {f.icon}
          </span>
        ))}
      </div>

      <div className="login-orbs" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
        <span className="orb orb-4" />
      </div>

      <div className="login-shell">
        <aside className="login-hero">
          <header className="login-hero-brand">
            <div className="brand-mark">🛒</div>
            <div className="brand-text">
              <div className="brand-name">NiteshPro <span>POS</span></div>
              <div className="brand-auth">Authorized POS System</div>
            </div>
          </header>

          <div className="login-hero-body">
            <div className="login-trial">
              <b>🎁 15 Days Free</b>
              <span>Full premium access · No card required</span>
            </div>
            <h2>Run your entire store from one premium screen.</h2>
            <p>
              Billing, inventory, accounting and staff — an international-grade
              point-of-sale built for retail that never stops.
            </p>
            <div className="login-mode-badges">
              <span className="mode-badge online">🌐 Online — Cloud Sync</span>
              <span className="mode-badge office">🏢 Office / Offline Mode</span>
            </div>
            <ul className="login-features">
              <li><span className="feat-ico">⚡</span> Lightning-fast billing &amp; barcode scanning</li>
              <li><span className="feat-ico">📦</span> Real-time multi-branch inventory</li>
              <li><span className="feat-ico">🧾</span> GST invoices &amp; complete accounting</li>
              <li><span className="feat-ico">🛰️</span> Works online <b>and</b> offline — data auto-syncs back</li>
            </ul>
          </div>

          <div className="login-hero-foot">
            <div className="login-trust">
              <span>🔒 Encrypted</span>
              <span>☁️ Cloud Sync</span>
              <span>📴 Offline Ready</span>
            </div>
            <div className="hero-trust-line">Trusted by growing retailers across India</div>
          </div>
        </aside>

        <section className="login-card login-card-premium">
          <div className="login-mini-brand">
            <span className="mini-mark">🛒</span>
            <span className="mini-name">NiteshPro <b>POS</b></span>
          </div>
          <div className="login-card-header">
            <div className="login-card-badge">🔐 Secure Sign In</div>
            <h1>Welcome back</h1>
            <div className="sub">
              {mode === 'password'
                ? 'Sign in to your NiteshPro POS workspace'
                : 'Enter your quick login PIN'}
            </div>
            <div className="login-mode-note">
              <span className="mode-badge online">🌐 Online</span>
              <span className="mode-badge office">🏢 Offline / Office Mode</span>
              <span className="mode-note-text">Donon support — internet nahi ho to billing phir bhi chalti rahegi.</span>
            </div>
            <div className="login-trial-chip"><b>🎁 15 Days Free</b> · full premium access</div>
          </div>

          <div className="login-tabs">
            <button className={mode === 'password' ? 'active' : ''} onClick={() => setMode('password')} type="button">Password</button>
            <button className={mode === 'pin' ? 'active' : ''} onClick={() => setMode('pin')} type="button">PIN</button>
          </div>

          {mode === 'password' ? (
            <form onSubmit={submitPassword}>
              <div className="field">
                <label>Username</label>
                <div className="input-affix">
                  <span className="affix-ico">👤</span>
                  <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your username" autoFocus required />
                </div>
              </div>
              <div className="field">
                <label>Password</label>
                <div className="input-affix">
                  <span className="affix-ico">🔑</span>
                  <input
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" className="affix-btn" onClick={() => setShowPassword((s) => !s)} title={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <Button type="submit" className="btn-block btn-login" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In →'}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitPin}>
              <div className="pin-display">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
                ))}
              </div>
              <div className="pin-pad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button key={d} type="button" onClick={() => pressPin(d)}>{d}</button>
                ))}
                <button type="button" onClick={() => setPin('')}>C</button>
                <button type="button" onClick={() => pressPin('0')}>0</button>
                <button type="button" onClick={() => setPin((p) => p.slice(0, -1))}>⌫</button>
              </div>
              <Button type="submit" className="btn-block btn-login" disabled={loading || pin.length < 4}>
                {loading ? 'Verifying…' : 'Login with PIN'}
              </Button>
            </form>
          )}

          <div className="login-help">
            <span className="help-ico">🎧</span> Need help? Call support
            <a href="tel:8810751872"> 📞 8810751872</a>
          </div>

          <div className="login-links">
            <Link className="btn-link" to="/downloads">💻 Desktop App · 📱 Mobile App</Link>
          </div>
        </section>
      </div>

      <div className="login-footer">NiteshPro POS · Authorized Retail Platform · © {new Date().getFullYear()}</div>
    </div>
  );
}
