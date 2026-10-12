import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Button, Card, Field, Badge, EmptyState, Spinner } from '../components/ui';
import { fmtDateTime } from '../utils/format';

export default function Marketing() {
  const [audience, setAudience] = useState(null);
  const [selected, setSelected] = useState([]);
  const [all, setAll] = useState(true);
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const { toast } = useToast();

  const loadCampaigns = useCallback(() => {
    api.get('/marketing/campaigns').then((r) => setCampaigns(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/marketing/audience').then((r) => setAudience(r.data.data || [])).catch(() => setAudience([]));
    loadCampaigns();
  }, [loadCampaigns]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const send = async () => {
    if (!message.trim()) return toast('Message is required', 'error');
    if (!all && selected.length === 0) return toast('Select at least one customer', 'error');
    setBusy(true);
    try {
      const r = await api.post('/marketing/campaign', {
        channel, subject, message,
        sendTo: all ? 'all' : 'selected',
        customerIds: all ? [] : selected,
      });
      toast(`Sent: ${r.data.data.sent}, failed: ${r.data.data.failed}`, 'success');
      setMessage('');
      setSelected([]);
      loadCampaigns();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <h2 className="mb-16">Marketing</h2>

      <Card title="New Campaign" className="mb-16">
        <div className="form-row">
          <Field label="Channel">
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </Field>
          <Field label="Send to">
            <select className="input" value={all ? 'all' : 'selected'} onChange={(e) => setAll(e.target.value === 'all')}>
              <option value="all">All customers ({audience?.length ?? 0})</option>
              <option value="selected">Selected customers ({selected.length})</option>
            </select>
          </Field>
        </div>
        {channel === 'email' && <Field label="Subject"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>}
        <Field label="Message"><textarea className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>

        {!all && (
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, padding: 8, marginBottom: 12 }}>
            {audience === null ? <Spinner /> : audience.length === 0 ? <p className="muted">No customers.</p> : audience.map((c) => (
              <label key={c._id} style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                <input type="checkbox" checked={selected.includes(c._id)} onChange={() => toggle(c._id)} />
                <span>{c.name} {c.email ? `· ${c.email}` : ''} {c.mobile ? `· ${c.mobile}` : ''}</span>
              </label>
            ))}
          </div>
        )}

        <Button onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send Campaign'}</Button>
        <p className="muted small" style={{ marginTop: 8 }}>
          Tip: Email/WhatsApp must be enabled for your branch in the Notifications page before sending.
        </p>
      </Card>

      <Card title="Campaign History">
        {campaigns.length === 0 ? (
          <EmptyState icon="📣" title="No campaigns sent yet" />
        ) : (
          <table className="table">
            <thead><tr><th>When</th><th>Channel</th><th>Subject</th><th>Recipients</th><th>Sent</th><th>Failed</th><th>Status</th></tr></thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c._id}>
                  <td>{fmtDateTime(c.createdAt)}</td>
                  <td>{c.channel}</td>
                  <td>{c.subject || '—'}</td>
                  <td>{c.recipients}</td>
                  <td>{c.sent}</td>
                  <td>{c.failed}</td>
                  <td><Badge tone={c.status === 'sent' ? 'success' : c.status === 'failed' ? 'danger' : 'warning'}>{c.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
