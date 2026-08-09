import React, { useEffect, useState } from 'react';
import { getLicenseStatus, checkLicense, getServerTime, LICENSE_STATES } from '../utils/license';
import { fmtDate } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useSync } from '../context/SyncContext';
import { Button, Card, Badge } from '../components/ui';
import { useNavigate } from 'react-router-dom';

export default function LicensePage() {
  const [info, setInfo] = useState(null);
  const [state, setState] = useState('CHECKING');
  const [effectiveNow, setEffectiveNow] = useState(null);
  const { toast } = useToast();
  const sync = useSync();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const license = await getLicenseStatus();
      setInfo(license);
      const result = await checkLicense();
      setState(result.state);
      if (result.effectiveNow) setEffectiveNow(result.effectiveNow);
    })();
  }, []);

  const payload = info?.payload;

  const stateBadge = {
    [LICENSE_STATES.VALID]: <Badge tone="success">VALID</Badge>,
    [LICENSE_STATES.EXPIRED]: <Badge tone="danger">EXPIRED</Badge>,
    [LICENSE_STATES.SUSPENDED]: <Badge tone="warning">SUSPENDED</Badge>,
    [LICENSE_STATES.NOT_ACTIVATED]: <Badge tone="neutral">NOT ACTIVATED</Badge>,
    [LICENSE_STATES.INVALID_SIGNATURE]: <Badge tone="danger">INVALID SIGNATURE</Badge>,
  };

  return (
    <div>
      <h2 className="mb-16">License</h2>
      <Card>
        {!payload ? (
          <div className="empty-state">
            <div className="icon">🔑</div>
            <div>No license activated on this device</div>
            <div className="muted small mt-8">This POS is running without license protection.</div>
          </div>
        ) : (
          <div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="label">License ID</div>
                <div className="value" style={{ fontSize: 18 }}>{payload.licenseId}</div>
              </div>
              <div className="stat-card">
                <div className="label">Business</div>
                <div className="value" style={{ fontSize: 18 }}>{payload.businessName}</div>
                <div className="sub">{payload.customerName}</div>
              </div>
              <div className="stat-card">
                <div className="label">Status</div>
                <div className="value" style={{ fontSize: 18 }}>{stateBadge[state]}</div>
                <div className="sub">RSA signature: {info?.signature ? 'verified ✓' : 'missing'}</div>
              </div>
              <div className="stat-card">
                <div className="label">Expiry Date</div>
                <div className="value" style={{ fontSize: 18 }}>{fmtDate(payload.expiryDate)}</div>
                <div className="sub">Start: {fmtDate(payload.startDate)}</div>
              </div>
            </div>

            <div className="flex-between" style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, fontSize: 13 }}>
              <span className="muted">Max devices allowed</span>
              <b>{payload.maxDevices}</b>
            </div>

            {effectiveNow && (
              <div className="muted small mt-8">
                Effective server-adjusted time: {fmtDate(effectiveNow)} {effectiveNow.toLocaleTimeString()} — protects against clock tampering.
              </div>
            )}

            <div className="flex mt-16 gap-8">
              <Button variant="ghost" onClick={() => { toast(`Sync status: ${sync.status}`, 'info'); }}>Check Sync Status</Button>
              <Button variant="ghost" onClick={() => navigate('/login')}>Lock Device</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
