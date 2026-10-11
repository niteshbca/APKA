import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui';

export default function Login() {
  const { login, loginPin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="login-page">
      <div className="login-card">
        <h1>🛒 NiteshPro POS</h1>
        <div className="sub">{mode === 'password' ? 'Sign in to your account' : 'Enter your quick login PIN'}</div>

        <div className="login-tabs">
          <button className={mode === 'password' ? 'active' : ''} onClick={() => setMode('password')} type="button">Password</button>
          <button className={mode === 'pin' ? 'active' : ''} onClick={() => setMode('pin')} type="button">PIN</button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={submitPassword}>
            <div className="field">
              <label>Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="btn-block" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
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
            <Button type="submit" className="btn-block" disabled={loading || pin.length < 4}>
              {loading ? 'Verifying...' : 'Login with PIN'}
            </Button>
          </form>
        )}

        <div className="muted small mt-16" style={{ textAlign: 'center' }}>
          Demo — admin/admin123 · cashier PIN 1234 · owner/owner123
        </div>
        <div className="muted small mt-8" style={{ textAlign: 'center' }}>
          <Link className="btn-link" to="/downloads">💻 Download Desktop App · 📱 Install Mobile App</Link>
        </div>
      </div>
    </div>
  );
}