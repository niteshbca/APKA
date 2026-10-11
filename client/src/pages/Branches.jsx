import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useBranch } from '../context/BranchContext';
import { Button, Card, Modal, Field, Badge, EmptyState, Spinner } from '../components/ui';

const NOTIF_EMPTY = {
  email: { enabled: false, host: '', port: 587, secure: false, user: '', password: '', fromName: '', fromEmail: '' },
  whatsapp: { enabled: false, provider: 'generic', apiUrl: '', accessToken: '', instanceId: '', phoneNumberId: '', senderNumber: '' },
  autoSend: { onSale: true, onLowStock: false },
  notify: { customerEmail: true, customerWhatsapp: true, ownerEmail: false, ownerWhatsapp: false },
  ownerEmail: '',
  ownerWhatsapp: '',
};

const EMPTY = {
  name: '', code: '', address: '', phone: '', email: '', gstin: '',
  isActive: true,
  settings: { invoicePrefix: 'INV', currency: 'INR', lowStockThreshold: 10 },
  notifications: NOTIF_EMPTY,
};

const WA_PROVIDERS = [
  { id: 'generic', label: 'Generic API (custom URL + token)' },
  { id: 'meta', label: 'WhatsApp Cloud API (Meta)' },
  { id: 'ultramsg', label: 'UltraMsg' },
  { id: 'twilio', label: 'Twilio' },
];

export default function Branches() {
  const [rows, setRows] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const { toast } = useToast();
  const { refresh } = useBranch();

  const load = () => {
    api.get('/branches').then((r) => setRows(r.data.data)).catch((e) => toast(e.message, 'error'));
  };

  useEffect(load, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setShowModal(true);
  };

  const openEdit = async (b) => {
    setEditingId(b._id);
    setForm({
      name: b.name || '',
      code: b.code || '',
      address: b.address || '',
      phone: b.phone || '',
      email: b.email || '',
      gstin: b.gstin || '',
      isActive: b.isActive !== false,
      settings: {
        invoicePrefix: b.settings?.invoicePrefix || 'INV',
        currency: b.settings?.currency || 'INR',
        lowStockThreshold: b.settings?.lowStockThreshold ?? 10,
      },
      notifications: NOTIF_EMPTY,
    });
    setShowModal(true);
    try {
      const r = await api.get('/notifications/settings', { params: { branch: b._id } });
      const s = r.data.data;
      if (s) {
        setForm((f) => ({
          ...f,
          notifications: {
            email: { ...NOTIF_EMPTY.email, ...(s.email || {}) },
            whatsapp: { ...NOTIF_EMPTY.whatsapp, ...(s.whatsapp || {}) },
            autoSend: { ...NOTIF_EMPTY.autoSend, ...(s.autoSend || {}) },
            notify: { ...NOTIF_EMPTY.notify, ...(s.notify || {}) },
            ownerEmail: s.ownerEmail || '',
            ownerWhatsapp: s.ownerWhatsapp || '',
          },
        }));
      }
    } catch (e) {
      /* settings may not exist yet */
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      return toast('Name and code are required', 'error');
    }
    try {
      if (editingId) {
        await api.put(`/branches/${editingId}`, form);
        toast('Branch updated', 'success');
      } else {
        await api.post('/branches', form);
        toast('Branch created', 'success');
      }
      setShowModal(false);
      setForm(EMPTY);
      setEditingId(null);
      load();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/branches/${b._id}`);
      toast('Branch deleted', 'success');
      load();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setSetting = (k) => (e) => setForm({ ...form, settings: { ...form.settings, [k]: e.target.value } });
  const setNotif = (group, k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, notifications: { ...f.notifications, [group]: { ...f.notifications[group], [k]: val } } }));
  };
  const setNotifTop = (k) => (e) => setForm((f) => ({ ...f, notifications: { ...f.notifications, [k]: e.target.value } }));
  const n = form.notifications || NOTIF_EMPTY;

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h2>Branches</h2>
          <div className="muted small">Manage multiple outlets / stores</div>
        </div>
        <Button onClick={openAdd}>＋ Add Branch</Button>
      </div>

      <Card>
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="🏬" title="No branches" sub="Add your first branch to get started" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Branch</th><th>Code</th><th>Contact</th><th>GSTIN</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {b.name} {b.isMain && <Badge tone="info">Main</Badge>}
                    </div>
                    <div className="muted small">{b.address || '—'}</div>
                  </td>
                  <td><span className="badge badge-neutral">{b.code}</span></td>
                  <td>
                    <div>{b.phone || '—'}</div>
                    <div className="muted small">{b.email || ''}</div>
                  </td>
                  <td className="muted small">{b.gstin || '—'}</td>
                  <td>{b.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Inactive</Badge>}</td>
                  <td>
                    <div className="flex gap-8">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>Edit</Button>
                      {!b.isMain && (
                        <Button size="sm" variant="danger" onClick={() => remove(b)}>Delete</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showModal} title={editingId ? 'Edit Branch' : 'Add Branch'} onClose={() => setShowModal(false)} width={560}>
        <div className="form-row">
          <Field label="Branch Name *"><input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Bandra Branch" /></Field>
          <Field label="Branch Code *"><input className="input" value={form.code} onChange={set('code')} placeholder="e.g. BAND" /></Field>
        </div>
        <Field label="Address"><input className="input" value={form.address} onChange={set('address')} /></Field>
        <div className="form-row">
          <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><input className="input" value={form.email} onChange={set('email')} /></Field>
        </div>
        <div className="form-row">
          <Field label="GSTIN"><input className="input" value={form.gstin} onChange={set('gstin')} /></Field>
          <Field label="Invoice Prefix"><input className="input" value={form.settings.invoicePrefix} onChange={setSetting('invoicePrefix')} /></Field>
        </div>
        <div className="form-row">
          <Field label="Low Stock Threshold">
            <input className="input" type="number" value={form.settings.lowStockThreshold} onChange={setSetting('lowStockThreshold')} />
          </Field>
          <Field label="Status">
            <select className="select" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>

        <details open style={{ margin: '8px 0 16px', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
            🔔 Sale Notifications — Email &amp; WhatsApp
            <span className="muted small" style={{ fontWeight: 400 }}> (is branch ke liye alag)</span>
          </summary>
          <div className="muted small" style={{ margin: '8px 0 12px' }}>
            Invoice confirm hone par customer ko isi branch ke email/WhatsApp se bhejenge.
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <label className="flex gap-8" style={{ alignItems: 'center', fontWeight: 600, marginBottom: 8 }}>
              <input type="checkbox" checked={!!n.email.enabled} onChange={setNotif('email', 'enabled')} />
              ✉️ Email (SMTP) enable
            </label>
            <div className="form-row">
              <Field label="SMTP Host"><input className="input" value={n.email.host} onChange={setNotif('email', 'host')} placeholder="smtp.gmail.com" /></Field>
              <Field label="Port"><input className="input" type="number" value={n.email.port} onChange={setNotif('email', 'port')} placeholder="587" /></Field>
            </div>
            <div className="form-row">
              <Field label="Email / Username"><input className="input" value={n.email.user} onChange={setNotif('email', 'user')} placeholder="shop@gmail.com" /></Field>
              <Field label="App Password"><input className="input" type="password" value={n.email.password} onChange={setNotif('email', 'password')} placeholder="16-char app password" /></Field>
            </div>
            <div className="form-row">
              <Field label="From Name"><input className="input" value={n.email.fromName} onChange={setNotif('email', 'fromName')} placeholder="My Store" /></Field>
              <Field label="From Email"><input className="input" value={n.email.fromEmail} onChange={setNotif('email', 'fromEmail')} placeholder="billing@store.com" /></Field>
            </div>
            <Field label="Security">
              <select className="select" value={n.email.secure ? 'ssl' : 'starttls'} onChange={(e) => setNotif('email', 'secure')({ target: { type: 'checkbox', checked: e.target.value === 'ssl' } })}>
                <option value="starttls">STARTTLS (587 / 25)</option>
                <option value="ssl">SSL/TLS (465)</option>
              </select>
            </Field>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
            <label className="flex gap-8" style={{ alignItems: 'center', fontWeight: 600, marginBottom: 8 }}>
              <input type="checkbox" checked={!!n.whatsapp.enabled} onChange={setNotif('whatsapp', 'enabled')} />
              💬 WhatsApp enable
            </label>
            <div className="form-row">
              <Field label="Provider">
                <select className="select" value={n.whatsapp.provider} onChange={setNotif('whatsapp', 'provider')}>
                  {WA_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Sender / From Number"><input className="input" value={n.whatsapp.senderNumber} onChange={setNotif('whatsapp', 'senderNumber')} placeholder="+91..." /></Field>
            </div>
            <Field label="API URL (generic / ultramsg)"><input className="input" value={n.whatsapp.apiUrl} onChange={setNotif('whatsapp', 'apiUrl')} placeholder="https://api.example.com/send" /></Field>
            <Field label="Access Token / API Key"><input className="input" type="password" value={n.whatsapp.accessToken} onChange={setNotif('whatsapp', 'accessToken')} /></Field>
            <div className="form-row">
              <Field label="Instance ID (ultramsg)"><input className="input" value={n.whatsapp.instanceId} onChange={setNotif('whatsapp', 'instanceId')} /></Field>
              <Field label="Phone Number ID (meta)"><input className="input" value={n.whatsapp.phoneNumberId} onChange={setNotif('whatsapp', 'phoneNumberId')} /></Field>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
            <label className="flex gap-8" style={{ alignItems: 'center', marginBottom: 6 }}>
              <input type="checkbox" checked={!!n.autoSend.onSale} onChange={setNotif('autoSend', 'onSale')} />
              Sale confirm par automatically bhejo
            </label>
            <div className="flex gap-16" style={{ flexWrap: 'wrap' }}>
              <label className="flex gap-8" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={!!n.notify.customerEmail} onChange={setNotif('notify', 'customerEmail')} /> Customer email
              </label>
              <label className="flex gap-8" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={!!n.notify.customerWhatsapp} onChange={setNotif('notify', 'customerWhatsapp')} /> Customer WhatsApp
              </label>
              <label className="flex gap-8" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={!!n.notify.ownerEmail} onChange={setNotif('notify', 'ownerEmail')} /> Owner email
              </label>
              <label className="flex gap-8" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={!!n.notify.ownerWhatsapp} onChange={setNotif('notify', 'ownerWhatsapp')} /> Owner WhatsApp
              </label>
            </div>
            <div className="form-row" style={{ marginTop: 8 }}>
              <Field label="Owner Email"><input className="input" value={n.ownerEmail} onChange={setNotifTop('ownerEmail')} placeholder="owner@store.com" /></Field>
              <Field label="Owner WhatsApp"><input className="input" value={n.ownerWhatsapp} onChange={setNotifTop('ownerWhatsapp')} placeholder="+91..." /></Field>
            </div>
          </div>
        </details>

        <Button className="btn-block" onClick={save}>Save Branch</Button>
      </Modal>
    </div>
  );
}