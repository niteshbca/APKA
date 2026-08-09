import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import db from '../db';
import { useToast } from '../context/ToastContext';
import { Button, Card, Field } from '../components/ui';

export default function Settings() {
  const [form, setForm] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    api.get('/settings').then((r) => {
      const s = r.data.data;
      const clean = {
        businessName: s.businessName,
        address: s.address,
        phone: s.phone,
        gstin: s.gstin,
        logoUrl: s.logoUrl,
        footerNote: s.footerNote,
        thermalWidth: s.thermalWidth,
        currency: s.currency,
        invoicePrefix: s.invoicePrefix,
      };
      setForm(clean);
      db.put('settings', { key: 'business_settings', ...clean });
    }).catch((e) => toast(e.message, 'error'));
  }, []);

  const save = async () => {
    try {
      const res = await api.put('/settings', form);
      await db.put('settings', { key: 'business_settings', ...res.data.data });
      toast('Settings saved', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h2 className="mb-16">Settings</h2>
      <Card title="Business Details">
        <div className="form-row">
          <Field label="Business Name"><input className="input" value={form.businessName || ''} onChange={set('businessName')} /></Field>
          <Field label="Phone"><input className="input" value={form.phone || ''} onChange={set('phone')} /></Field>
        </div>
        <Field label="Address"><input className="input" value={form.address || ''} onChange={set('address')} /></Field>
        <div className="form-row">
          <Field label="GSTIN"><input className="input" value={form.gstin || ''} onChange={set('gstin')} /></Field>
          <Field label="Logo URL"><input className="input" value={form.logoUrl || ''} onChange={set('logoUrl')} placeholder="Optional image URL" /></Field>
        </div>
      </Card>

      <Card title="Invoice & Printing" className="mt-16">
        <div className="form-row">
          <Field label="Thermal Printer Width">
            <select className="select" value={form.thermalWidth || '80mm'} onChange={set('thermalWidth')}>
              <option value="80mm">80mm</option>
              <option value="58mm">58mm</option>
            </select>
          </Field>
          <Field label="Invoice Prefix"><input className="input" value={form.invoicePrefix || 'INV'} onChange={set('invoicePrefix')} /></Field>
        </div>
        <Field label="Currency"><input className="input" value={form.currency || '₹'} onChange={set('currency')} /></Field>
        <Field label="Footer Note"><input className="input" value={form.footerNote || ''} onChange={set('footerNote')} /></Field>
        <Button className="btn-block" onClick={save}>Save Settings</Button>
      </Card>
    </div>
  );
}
