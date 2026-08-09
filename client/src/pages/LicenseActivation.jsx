import React, { useState } from 'react';
import api from '../api/axios';
import { getDeviceId, saveLicense, saveValidationState } from '../utils/license';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui';

export default function LicenseActivation({ onActivated }) {
  const [licenseId, setLicenseId] = useState('');
  const [deviceName, setDeviceName] = useState('Main POS Terminal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const activate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const deviceId = await getDeviceId();
      const res = await api.post('/license/activate', {
        licenseId: licenseId.trim().toUpperCase(),
        deviceId,
        deviceName,
        platform: navigator.userAgent,
      });
      const d = res.data.data;
      await saveLicense({
        payload: d.license,
        signature: d.signature,
        boundDeviceId: d.deviceId,
        publicKey: null,
      });
      await saveValidationState({ valid: true, serverTime: d.serverTime });
      toast('License activated successfully', 'success');
      onActivated();
    } catch (err) {
      setError(err.message || 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="license-screen">
      <div className="license-card">
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔑</div>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Activate your License</h1>
        <p className="muted">Enter the License ID provided by your software vendor to activate this device.</p>
        <form onSubmit={activate} style={{ textAlign: 'left', marginTop: 22 }}>
          <div className="field">
            <label>License ID</label>
            <input
              className="input"
              value={licenseId}
              onChange={(e) => setLicenseId(e.target.value)}
              placeholder="e.g. NP-4587-ABCD"
              style={{ textTransform: 'uppercase', letterSpacing: 1 }}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Device Name</label>
            <input className="input" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
          </div>
          {error && <div className="badge badge-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <Button type="submit" className="btn-block" disabled={loading}>
            {loading ? 'Activating...' : 'Activate License'}
          </Button>
        </form>
      </div>
    </div>
  );
}
