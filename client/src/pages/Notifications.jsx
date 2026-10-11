import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Card, Field, Badge, Spinner } from '../components/ui';

const PROVIDERS = [
  { value: 'generic', label: 'Generic HTTP API (custom URL + token)' },
  { value: 'meta', label: 'WhatsApp Cloud API (Meta / Facebook)' },
  { value: 'ultramsg', label: 'UltraMsg' },
  { value: 'twilio', label: 'Twilio WhatsApp' },
];

const PLACEHOLDERS = [
  '{{businessName}}', '{{invoiceNo}}', '{{date}}', '{{customerName}}',
  '{{customerMobile}}', '{{total}}', '{{subtotal}}', '{{discount}}', '{{gstTotal}}',
  '{{paymentMode}}', '{{items}}', '{{cashierName}}', '{{branchName}}',
];

const EMPTY = {
  email: { enabled: false, host: '', port: 587, secure: false, user: '', password: '', fromName: '', fromEmail: '', replyTo: '' },
  whatsapp: { enabled: false, provider: 'generic', apiUrl: '', accessToken: '', instanceId: '', phoneNumberId: '', senderNumber: '' },
  autoSend: { onSale: true, onLowStock: false },
  notify: { customerEmail: true, customerWhatsapp: true, ownerEmail: false, ownerWhatsapp: false },
  ownerEmail: '',
  ownerWhatsapp: '',
  template: { emailSubject: '', emailBody: '', whatsappBody: '' },
};

export default function Notifications() {
  const { branches, activeBranch } = useBranch();
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const [branchId, setBranchId] = useState(activeBranch?._id || '');
  const [form, setForm] = useState(EMPTY);
  const [meta, setMeta] = useState({ hasPassword: false, hasAccessToken: false });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!branchId && activeBranch?._id) setBranchId(activeBranch._id);
  }, [activeBranch, branchId]);

  const loadLogs = useCallback(async (id) => {
    try {
      const res = await api.get('/notifications/logs', { params: { branch: id, limit: 30 } });
      setLogs(res.data.data || []);
    } catch {
      setLogs([]);
    }
  }, []);

  const load = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get('/notifications/settings', { params: { branch: id } });
      const s = res.data.data;
      if (s) {
        setForm({
          email: { ...EMPTY.email, ...s.email, password: '' },
          whatsapp: { ...EMPTY.whatsapp, ...s.whatsapp, accessToken: '' },
          autoSend: { ...EMPTY.autoSend, ...s.autoSend },
          notify: { ...EMPTY.notify, ...s.notify },
          ownerEmail: s.ownerEmail || '',
          ownerWhatsapp: s.ownerWhatsapp || '',
          template: { ...EMPTY.template, ...s.template },
        });
        setMeta({ hasPassword: !!s.email?.hasPassword, hasAccessToken: !!s.whatsapp?.hasAccessToken });
      } else {
        setForm(EMPTY);
      }
      await loadLogs(id);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [loadLogs, toast]);

  useEffect(() => { load(branchId); }, [branchId, load]);

  const setEmail = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, email: { ...f.email, [k]: v } }));
  };
  const setWa = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, whatsapp: { ...f.whatsapp, [k]: v } }));
  };
  const setToggle = (group, k) => (e) => setForm((f) => ({ ...f, [group]: { ...f[group], [k]: e.target.checked } }));
  const setTpl = (k) => (e) => setForm((f) => ({ ...f, template: { ...f.template, [k]: e.target.value } }));

  const save = async () => {
    if (!branchId) return toast('Select a branch first', 'error');
    setSaving(true);
    try {
      const res = await api.put('/notifications/settings', { ...form, branch: branchId });
      const s = res.data.data;
      setMeta({ hasPassword: !!s.email?.hasPassword, hasAccessToken: !!s.whatsapp?.hasAccessToken });
      setForm((f) => ({ ...f, email: { ...f.email, password: '' }, whatsapp: { ...f.whatsapp, accessToken: '' } }));
      toast('Notification settings saved', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const testEmail = async () => {
    const to = window.prompt('Send test email to:', form.email.fromEmail || form.ownerEmail || form.email.user || '');
    if (to === null) return;
    setTesting('email');
    try {
      const res = await api.post('/notifications/test-email', { branch: branchId, to });
      if (res.data.success) toast('Test email sent ✓', 'success');
      else toast(res.data.data?.error || res.data.data?.reason || 'Email test failed', 'error');
      loadLogs(branchId);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setTesting('');
    }
  };

  const testWhatsapp = async () => {
    const to = window.prompt('Send test WhatsApp to:', form.ownerWhatsapp || form.whatsapp.senderNumber || '');
    if (to === null) return;
    setTesting('whatsapp');
    try {
      const res = await api.post('/notifications/test-whatsapp', { branch: branchId, to });
      if (res.data.success) toast('Test WhatsApp sent ✓', 'success');
      else toast(res.data.data?.error || res.data.data?.reason || 'WhatsApp test failed', 'error');
      loadLogs(branchId);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setTesting('');
    }
  };

  const doPreview = async () => {
    try {
      const res = await api.get('/notifications/preview', { params: { branch: branchId } });
      setPreview(res.data.data);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const resend = async (log) => {
    try {
      const res = await api.post(`/notifications/resend/${log._id}`, {});
      if (res.data.success) toast('Resent ✓', 'success');
      else toast(res.data.data?.error || 'Resend failed', 'error');
      loadLogs(branchId);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const branch = branches.find((b) => b._id === branchId) || activeBranch;

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h2>Notifications</h2>
          <div className="muted small">Per-branch Email (SMTP) & WhatsApp — auto-sent on every sale</div>
        </div>
        {isSuperAdmin && branches.length > 0 && (
          <select className="select" style={{ maxWidth: 260 }} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid-2">
          <Card title="Email (SMTP)" action={<Badge tone={form.email.enabled ? 'success' : 'neutral'}>{form.email.enabled ? 'Enabled' : 'Disabled'}</Badge>}>
            <label className="flex gap-8 mb-16" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={form.email.enabled} onChange={setEmail('enabled')} />
              Enable email notifications
            </label>
            <div className="form-row">
              <Field label="SMTP Host"><input className="input" placeholder="smtp.gmail.com" value={form.email.host} onChange={setEmail('host')} /></Field>
              <Field label="Port"><input className="input" type="number" value={form.email.port} onChange={setEmail('port')} /></Field>
            </div>
            <div className="form-row">
              <Field label="Email / Username"><input className="input" placeholder="shop@example.com" value={form.email.user} onChange={setEmail('user')} /></Field>
              <Field label="Email Password / App password">
                <input className="input" type="password" placeholder={meta.hasPassword ? '•••••• (saved)' : 'password'} value={form.email.password} onChange={setEmail('password')} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="From Name"><input className="input" placeholder="NiteshPro Store" value={form.email.fromName} onChange={setEmail('fromName')} /></Field>
              <Field label="From Email"><input className="input" placeholder="shop@example.com" value={form.email.fromEmail} onChange={setEmail('fromEmail')} /></Field>
            </div>
            <div className="form-row">
              <Field label="Reply-To (optional)"><input className="input" value={form.email.replyTo} onChange={setEmail('replyTo')} /></Field>
              <Field label="Secure (SSL 465)">
                <select className="select" value={form.email.secure ? 'yes' : 'no'} onChange={(e) => setForm((f) => ({ ...f, email: { ...f.email, secure: e.target.value === 'yes' } }))}>
                  <option value="no">No — STARTTLS (587 / 25)</option>
                  <option value="yes">Yes — SSL (465)</option>
                </select>
              </Field>
            </div>
            <Button variant="ghost" onClick={testEmail} disabled={testing === 'email'}>{testing === 'email' ? 'Sending…' : '✉️ Send Test Email'}</Button>
          </Card>

          <Card title="WhatsApp" action={<Badge tone={form.whatsapp.enabled ? 'success' : 'neutral'}>{form.whatsapp.enabled ? 'Enabled' : 'Disabled'}</Badge>}>
            <label className="flex gap-8 mb-16" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={form.whatsapp.enabled} onChange={setWa('enabled')} />
              Enable WhatsApp notifications
            </label>
            <Field label="Provider">
              <select className="select" value={form.whatsapp.provider} onChange={setWa('provider')}>
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <div className="form-row">
              <Field label="API URL (optional)"><input className="input" placeholder="https://…" value={form.whatsapp.apiUrl} onChange={setWa('apiUrl')} /></Field>
              <Field label="Access Token / API Key">
                <input className="input" type="password" placeholder={meta.hasAccessToken ? '•••••• (saved)' : 'token'} value={form.whatsapp.accessToken} onChange={setWa('accessToken')} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Instance ID (UltraMsg / Twilio SID)"><input className="input" value={form.whatsapp.instanceId} onChange={setWa('instanceId')} /></Field>
              <Field label="Phone Number ID (Meta)"><input className="input" value={form.whatsapp.phoneNumberId} onChange={setWa('phoneNumberId')} /></Field>
            </div>
            <Field label="Sender WhatsApp Number"><input className="input" placeholder="+91…" value={form.whatsapp.senderNumber} onChange={setWa('senderNumber')} /></Field>
            <Button variant="ghost" onClick={testWhatsapp} disabled={testing === 'whatsapp'}>{testing === 'whatsapp' ? 'Sending…' : '💬 Send Test WhatsApp'}</Button>
          </Card>
        </div>
      )}

      {!loading && (
        <Card title="Auto-send & Recipients" className="mt-16">
          <div className="form-row-3">
            <label className="flex gap-8" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={form.autoSend.onSale} onChange={setToggle('autoSend', 'onSale')} /> On every sale
            </label>
            <label className="flex gap-8" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={form.autoSend.onLowStock} onChange={setToggle('autoSend', 'onLowStock')} /> On low stock (advanced)
            </label>
          </div>
          <div className="form-row-3 mt-16">
            <label className="flex gap-8" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={form.notify.customerEmail} onChange={setToggle('notify', 'customerEmail')} /> Email to customer
            </label>
            <label className="flex gap-8" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={form.notify.customerWhatsapp} onChange={setToggle('notify', 'customerWhatsapp')} /> WhatsApp to customer
            </label>
            <label className="flex gap-8" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={form.notify.ownerEmail} onChange={setToggle('notify', 'ownerEmail')} /> Email copy to owner
            </label>
            <label className="flex gap-8" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={form.notify.ownerWhatsapp} onChange={setToggle('notify', 'ownerWhatsapp')} /> WhatsApp copy to owner
            </label>
          </div>
          <div className="form-row mt-16">
            <Field label="Owner Email (copy)"><input className="input" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} /></Field>
            <Field label="Owner WhatsApp (copy)"><input className="input" value={form.ownerWhatsapp} onChange={(e) => setForm({ ...form, ownerWhatsapp: e.target.value })} /></Field>
          </div>
        </Card>
      )}

      {!loading && (
        <Card title="Message Templates" className="mt-16" action={<Button size="sm" variant="ghost" onClick={doPreview}>👁 Preview</Button>}>
          <div className="muted small mb-8">Placeholders: {PLACEHOLDERS.map((p) => <code key={p} style={{ marginRight: 6 }}>{p}</code>)}</div>
          <Field label="Email Subject"><input className="input" value={form.template.emailSubject} onChange={setTpl('emailSubject')} /></Field>
          <Field label="Email Body (plain text)"><textarea className="input" rows="4" value={form.template.emailBody} onChange={setTpl('emailBody')} /></Field>
          <Field label="WhatsApp Message"><textarea className="input" rows="4" value={form.template.whatsappBody} onChange={setTpl('whatsappBody')} /></Field>
        </Card>
      )}

      <div className="mt-16">
        <Button className="btn-block" onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save Notification Settings${branch ? ' — ' + branch.name : ''}`}</Button>
      </div>

      {preview && (
        <Card title="Template Preview" className="mt-16" action={<Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Close</Button>}>
          <Field label="Email Subject"><div className="muted">{preview.emailSubject}</div></Field>
          <Field label="Email Body"><pre className="code-block">{preview.emailBody}</pre></Field>
          <Field label="WhatsApp"><pre className="code-block">{preview.whatsappBody}</pre></Field>
        </Card>
      )}

      <Card title="Delivery Log" className="mt-16" action={<Button size="sm" variant="ghost" onClick={() => loadLogs(branchId)}>↻ Refresh</Button>}>
        {logs.length === 0 ? (
          <div className="muted small">No notifications yet. Once a sale is made (or a test is sent) it will appear here.</div>
        ) : (
          <table className="table">
            <thead><tr><th>When</th><th>Channel</th><th>To</th><th>Invoice</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td className="muted small">{new Date(l.createdAt).toLocaleString('en-IN')}</td>
                  <td>{l.channel === 'email' ? '✉️ Email' : '💬 WhatsApp'}</td>
                  <td className="muted small">{l.to || '—'}</td>
                  <td className="muted small">{l.invoiceNo || '—'}</td>
                  <td>
                    <Badge tone={l.status === 'sent' ? 'success' : l.status === 'failed' ? 'danger' : 'neutral'}>{l.status}</Badge>
                    {l.error && <div className="muted small" style={{ maxWidth: 220 }}>{l.error}</div>}
                  </td>
                  <td><Button size="sm" variant="ghost" onClick={() => resend(l)}>Resend</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
