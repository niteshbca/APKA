import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Button, Card, Modal, Field, Badge, EmptyState, Spinner } from '../components/ui';
import { fmtDate, fmtDateTime } from '../utils/format';

const emptyForm = { customerName: '', businessName: '', startDate: new Date().toISOString().slice(0, 10), expiryDate: '', maxDevices: '1', note: '' };

export default function LicenseAdmin() {
  const [rows, setRows] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expiryEdit, setExpiryEdit] = useState(null);
  const [expiryDate, setExpiryDate] = useState('');
  const { toast } = useToast();

  const load = () => {
    api.get('/admin/license').then((r) => setRows(r.data.data)).catch((e) => toast(e.message, 'error'));
  };

  useEffect(load, []);

  const create = async () => {
    if (!form.customerName || !form.businessName || !form.expiryDate) return toast('Customer, business and expiry required', 'error');
    try {
      const res = await api.post('/admin/license', form);
      toast(`License created: ${res.data.data.licenseId}`, 'success');
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const renew = async () => {
    if (!expiryDate) return toast('Pick an expiry date', 'error');
    try {
      await api.post(`/admin/license/${expiryEdit._id}/renew`, { expiryDate });
      toast('License renewed & re-signed', 'success');
      setExpiryEdit(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const setStatus = async (l, status) => {
    try {
      await api.post(`/admin/license/${l._id}/${status}`);
      toast(`License ${status === 'suspend' ? 'suspended' : 'activated'}`, 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const setMaxDevices = async (l) => {
    const v = prompt('Max allowed devices:', l.maxDevices);
    if (!v) return;
    try {
      await api.post(`/admin/license/${l._id}/max-devices`, { maxDevices: Number(v) });
      toast('Max devices updated', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const blockDevice = async (deviceId, block) => {
    try {
      await api.post(`/admin/license/devices/${deviceId}/${block ? 'block' : 'allow'}`);
      toast('Device updated', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>License Admin Panel</h2>
        <Button onClick={() => setShowModal(true)}>＋ Create License</Button>
      </div>

      <Card title="Licenses">
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="🛡️" title="No licenses created" sub="Create a license and share the License ID with your customer" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>License ID</th><th>Customer</th><th>Business</th><th>Start</th><th>Expiry</th><th>Status</th><th>Devices</th><th>Last Validated</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <React.Fragment key={l._id}>
                  <tr>
                    <td style={{ fontWeight: 700 }}>{l.licenseId}</td>
                    <td>{l.customerName}</td>
                    <td>{l.businessName}</td>
                    <td>{fmtDate(l.startDate)}</td>
                    <td style={{ color: new Date(l.expiryDate) < new Date() ? 'var(--danger)' : undefined, fontWeight: 600 }}>{fmtDate(l.expiryDate)}</td>
                    <td>
                      <Badge tone={l.status === 'active' ? 'success' : l.status === 'suspended' ? 'warning' : 'danger'}>{l.status}</Badge>
                    </td>
                    <td>{l.devices?.length || 0} / {l.maxDevices}</td>
                    <td className="muted small">{l.lastValidatedAt ? fmtDateTime(l.lastValidatedAt) : '—'}</td>
                    <td>
                      <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                        <Button size="sm" variant="ghost" onClick={() => { setExpiryEdit(l); setExpiryDate(l.expiryDate?.slice(0, 10)); }}>Renew</Button>
                        {l.status === 'active' ? (
                          <Button size="sm" variant="warning" onClick={() => setStatus(l, 'suspend')}>Suspend</Button>
                        ) : (
                          <Button size="sm" variant="success" onClick={() => setStatus(l, 'activate')}>Activate</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setMaxDevices(l)}>Devices</Button>
                      </div>
                    </td>
                  </tr>
                  {l.devices?.length > 0 && (
                    <tr>
                      <td colSpan={9} style={{ background: '#f8fafc' }}>
                        <div className="small">
                          {l.devices.map((d) => (
                            <span key={d.deviceId} className="flex gap-8" style={{ alignItems: 'center', marginBottom: 4 }}>
                              <Badge tone={d.active ? 'success' : 'danger'}>{d.active ? 'ON' : 'OFF'}</Badge>
                              <code>{d.deviceId}</code> — {d.name} · {d.platform} · last seen {d.lastSeenAt ? fmtDateTime(d.lastSeenAt) : '—'}
                              <Button size="sm" variant="ghost" onClick={() => blockDevice(d.deviceId, d.active)}>{d.active ? 'Block' : 'Allow'}</Button>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showModal} title="Create License" onClose={() => setShowModal(false)} width={560}>
        <div className="form-row">
          <Field label="Customer Name *"><input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></Field>
          <Field label="Business Name *"><input className="input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field>
        </div>
        <div className="form-row-3">
          <Field label="Start Date"><input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Expiry Date *"><input className="input" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></Field>
          <Field label="Max Devices"><input className="input" type="number" min="1" value={form.maxDevices} onChange={(e) => setForm({ ...form, maxDevices: e.target.value })} /></Field>
        </div>
        <Field label="Note"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <Button className="btn-block" onClick={create}>Create & Sign License</Button>
      </Modal>

      <Modal open={!!expiryEdit} title={`Renew License — ${expiryEdit?.licenseId || ''}`} onClose={() => setExpiryEdit(null)} width={420}>
        <Field label="New Expiry Date"><input className="input" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></Field>
        <p className="muted small">Renewing re-signs the license with the server private key. The POS will accept the new expiry after its next online validation.</p>
        <Button className="btn-block" onClick={renew}>Renew License</Button>
      </Modal>
    </div>
  );
}
