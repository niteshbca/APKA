import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import db from '../db';
import { useToast } from '../context/ToastContext';
import { Button, Card, Field } from '../components/ui';
import { ACCENTS, applyAccent, savedAccent, DEFAULT_ACCENT } from '../utils/theme';
import { generateGuidePdf } from '../utils/guidePdf';
import { BUSINESS_TYPES, getBusinessType } from '../utils/businessTypes';

export default function Settings() {
  const [form, setForm] = useState({});
  const [accent, setAccent] = useState(savedAccent());
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
        accentColor: s.accentColor || DEFAULT_ACCENT,
        businessType: s.businessType || 'general',
      };
      setForm(clean);
      if (s.accentColor) { applyAccent(s.accentColor); setAccent(s.accentColor); }
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

  const pickAccent = (hex) => {
    const applied = applyAccent(hex);
    setAccent(applied);
    setForm((f) => ({ ...f, accentColor: applied }));
    api.put('/settings', { accentColor: applied }).catch(() => {});
  };

  const downloadGuide = () => {
    try {
      generateGuidePdf(form);
      toast('User guide PDF downloaded', 'success');
    } catch (e) {
      toast(e.message || 'Could not create PDF', 'error');
    }
  };

  const activeType = getBusinessType(form.businessType || 'general');

  const chooseType = (key) => {
    setForm((f) => ({ ...f, businessType: key }));
    api.put('/settings', { businessType: key }).catch(() => {});
  };

  const applySuggestedCategories = async () => {
    const bt = getBusinessType(form.businessType || 'general');
    try {
      const existing = await api.get('/categories');
      const have = new Set((existing.data.data || []).map((c) => String(c.name).toLowerCase()));
      let added = 0;
      for (const name of bt.categories) {
        if (have.has(name.toLowerCase())) continue;
        try { await api.post('/categories', { name }); added += 1; } catch (e) { /* skip duplicates */ }
      }
      toast(added ? `${added} categories added` : 'Categories already exist', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div>
      <h2 className="mb-16">Settings</h2>

      <Card title="Help & Support">
        <div className="muted small mb-16">
          Poori user guide PDF download karein — isme shuru se lekar billing, inventory,
          reports, backup aur troubleshooting tak sab step-by-step likha hai. Naye staff
          ko training dene ke liye perfect.
        </div>
        <Button onClick={downloadGuide}>⬇️ Download User Guide (PDF)</Button>
      </Card>

      <Card title="Appearance" className="mt-16">
        <div className="muted small mb-16">
          Apni brand colour chunein — ye poore software (buttons, sidebar, charts) par turant lag jayegi aur save rahegi.
        </div>
        <div className="swatch-grid">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              className={`swatch ${accent.toLowerCase() === a.value ? 'active' : ''}`}
              style={{ background: a.value }}
              title={a.name}
              onClick={() => pickAccent(a.value)}
            >
              {accent.toLowerCase() === a.value ? '✓' : ''}
            </button>
          ))}
        </div>
        <div className="form-row mt-16">
          <Field label="Custom colour">
            <div className="color-pick">
              <input type="color" className="color-input" value={accent} onChange={(e) => pickAccent(e.target.value)} />
              <span className="muted small">{accent.toUpperCase()}</span>
            </div>
          </Field>
          <Field label="&nbsp;">
            <Button variant="ghost" onClick={() => pickAccent(DEFAULT_ACCENT)}>Reset to default</Button>
          </Field>
        </div>
      </Card>

      <Card title="Business Type" className="mt-16">
        <div className="muted small mb-16">
          Apne business ka type chunein (Kirana, Clothing, Restaurant, Electronics, Medical…).
          Ek click me ready-made product categories bhi add kar sakte hain.
        </div>
        <div className="biz-grid mb-16">
          {BUSINESS_TYPES.map((b) => (
            <button
              key={b.key}
              type="button"
              className={`biz-tile ${(form.businessType || 'general') === b.key ? 'active' : ''}`}
              onClick={() => chooseType(b.key)}
            >
              <span className="biz-ico">{b.icon}</span>
              <span className="biz-label">{b.label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="ghost" onClick={applySuggestedCategories}>+ Add suggested categories</Button>
          <span className="muted small">{activeType.icon} {activeType.tagline}</span>
        </div>
      </Card>

      <Card title="Business Details" className="mt-16">
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
