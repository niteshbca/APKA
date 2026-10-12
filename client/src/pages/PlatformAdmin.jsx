import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { Card, Button, Badge, Spinner, Modal, Field, EmptyState } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/format';

const STATUS_TONES = { active: 'success', trial: 'warning', suspended: 'danger', cancelled: 'neutral' };
const emptyForm = { companyName: '', ownerName: '', username: '', email: '', phone: '', password: '', plan: 'starter' };

export default function PlatformAdmin() {
  const { toast } = useToast();
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/tenants/platform/list', { params: { search } });
      setRows(res.data.data);
    } catch (err) {
      setRows([]);
      toast(err.response?.data?.message || err.message, 'error');
    }
  }, [search, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.companyName || !form.ownerName || !form.username || !form.password) {
      toast('Company, owner, username and password are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/tenants/platform', form);
      toast('Tenant created', 'success');
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (tenant, status) => {
    try {
      await api.put(`/tenants/platform/${tenant._id}`, { status });
      toast(`Tenant ${status}`, 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.message || err.message, 'error');
    }
  };

  const setPlan = async (tenant, plan) => {
    try {
      await api.put(`/tenants/platform/${tenant._id}`, { plan });
      toast('Plan updated', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.message || err.message, 'error');
    }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Platform Tenants</h2>
        <Button onClick={() => { setForm(emptyForm); setShowModal(true); }}>＋ New Tenant</Button>
      </div>

      <Card>
        <div className="flex gap-8 mb-16">
          <input
            className="input"
            placeholder="Search company or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="🌐" title="No tenants" sub="Create the first tenant to get started" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Company</th><th>Slug</th><th>Plan</th><th>Status</th><th>Modules</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t._id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td className="muted">{t.slug}</td>
                  <td>
                    <select className="select" style={{ maxWidth: 140 }} value={t.plan} onChange={(e) => setPlan(t, e.target.value)}>
                      {['trial', 'starter', 'professional', 'enterprise'].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td><Badge tone={STATUS_TONES[t.status] || 'neutral'}>{t.status}</Badge></td>
                  <td className="muted">{(t.enabledModules || []).length}</td>
                  <td className="muted">{fmtDate(t.createdAt)}</td>
                  <td>
                    <div className="flex gap-8">
                      {t.status !== 'active' && <Button size="sm" variant="ghost" onClick={() => setStatus(t, 'active')}>Activate</Button>}
                      {t.status !== 'suspended' && <Button size="sm" variant="danger" onClick={() => setStatus(t, 'suspended')}>Suspend</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={showModal} title="New Tenant" onClose={() => setShowModal(false)} width={620}>
        <div className="form-row">
          <Field label="Company Name *"><input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
          <Field label="Owner Name *"><input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Owner Username *"><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
          <Field label="Password *"><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Email"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <Field label="Plan">
          <select className="select" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
            {['trial', 'starter', 'professional', 'enterprise'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Button className="btn-block" onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create Tenant'}</Button>
      </Modal>
    </div>
  );
}
