import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Button, Card, Badge, StatCard } from '../components/ui';

export default function Integrations() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/integrations/status').then((r) => setStatus(r.data.data)).catch((e) => setError(e.message));
  }, []);

  const tone = (ok) => (ok ? 'success' : 'neutral');
  const label = (ok) => (ok ? 'Connected' : 'Not configured');

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Integrations</h2>
        <Button onClick={() => navigate('/notifications')}>Configure Email / WhatsApp</Button>
      </div>

      {error && <p className="muted mb-16">Could not load status: {error}</p>}

      <div className="kpi-grid mb-16">
        <StatCard label="API server" value={status?.api?.healthy ? 'Online' : '—'} tone="success" icon="🔌" />
        <StatCard label="Registered devices" value={status?.devices ?? '—'} icon="💻" />
        <StatCard label="Cloud sync" value={status?.cloudSync?.enabled ? 'Enabled' : 'Off'} tone={tone(status?.cloudSync?.enabled)} icon="☁️" />
      </div>

      <Card title="Service Connections" className="mb-16">
        <table className="table">
          <thead><tr><th>Service</th><th>Status</th><th>Details</th></tr></thead>
          <tbody>
            <tr>
              <td><b>Email (SMTP)</b></td>
              <td><Badge tone={tone(status?.email?.enabled)}>{label(status?.email?.enabled)}</Badge></td>
              <td className="muted">{status?.email?.host || '—'}{status?.email?.from ? ` · ${status.email.from}` : ''}</td>
            </tr>
            <tr>
              <td><b>WhatsApp</b></td>
              <td><Badge tone={tone(status?.whatsapp?.enabled)}>{label(status?.whatsapp?.enabled)}</Badge></td>
              <td className="muted">{status?.whatsapp?.provider || '—'}</td>
            </tr>
            <tr>
              <td><b>Cloud sync</b></td>
              <td><Badge tone={tone(status?.cloudSync?.enabled)}>{label(status?.cloudSync?.enabled)}</Badge></td>
              <td className="muted">Set CLOUD_SYNC_URL + CLOUD_SYNC_TOKEN to enable multi-branch cloud backups</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="API Access">
        <p className="muted">Base URL: <code>{status?.api?.base || '/api'}</code></p>
        <p className="muted small">Server time: {status?.api?.serverTime || '—'}</p>
      </Card>
    </div>
  );
}
