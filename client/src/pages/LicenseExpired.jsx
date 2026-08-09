import React, { useState } from 'react';
import api from '../api/axios';
import { getDeviceId, saveLicense, saveValidationState } from '../utils/license';
import { fmtDate, money } from '../utils/format';
import { Button } from '../components/ui';

export default function LicenseExpired({ state, license, onRenewed }) {
  const [renewalCode, setRenewalCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const payload = license?.payload;

  const titles = {
    EXPIRED: 'Your software license has expired. Please renew your license.',
    SUSPENDED: 'Your license has been suspended. Contact your vendor.',
    INVALID_SIGNATURE: 'License verification failed. Please contact support.',
    DEVICE_NOT_BOUND: 'This device is not authorized for this license.',
    CORRUPTED: 'License data is corrupted. Please re-activate.',
  };

  const renew = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const deviceId = await getDeviceId();
      const res = await api.post('/license/validate', { licenseId: renewalCode.trim().toUpperCase(), deviceId });
      const d = res.data.data;
      await saveLicense({ payload: d.license, signature: d.signature, boundDeviceId: d.deviceId || deviceId, publicKey: null });
      await saveValidationState({ valid: true, serverTime: d.serverTime });
      onRenewed();
    } catch (err) {
      setError(err.message || 'Renewal failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="license-screen">
      <div className="license-card">
        <div style={{ fontSize: 44, marginBottom: 12 }}>⛔</div>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>{titles[state] || 'License issue'}</h1>

        {payload && (
          <div style={{ textAlign: 'left', background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13 }}>
            <div className="flex-between"><span className="muted">License ID</span><b>{payload.licenseId}</b></div>
            <div className="flex-between"><span className="muted">Business</span><b>{payload.businessName}</b></div>
            <div className="flex-between"><span className="muted">Customer</span><b>{payload.customerName}</b></div>
            <div className="flex-between"><span className="muted">Expiry</span><b>{fmtDate(payload.expiryDate)}</b></div>
            <div className="flex-between"><span className="muted">Status</span><b className="badge badge-danger">{state}</b></div>
          </div>
        )}

        <p className="muted small mb-16">If you have renewed your license, enter the License ID below to refresh it.</p>
        <form onSubmit={renew}>
          <div className="field">
            <label>License ID</label>
            <input className="input" value={renewalCode} onChange={(e) => setRenewalCode(e.target.value)} placeholder="NP-XXXX-XXXX" style={{ textTransform: 'uppercase' }} />
          </div>
          {error && <div className="badge badge-danger mb-16">{error}</div>}
          <Button type="submit" className="btn-block" disabled={loading || !renewalCode}>
            {loading ? 'Checking...' : 'Validate Renewal'}
          </Button>
        </form>
        <button className="btn btn-ghost btn-block mt-16" onClick={onRenewed}>Try Again</button>
      </div>
    </div>
  );
}
