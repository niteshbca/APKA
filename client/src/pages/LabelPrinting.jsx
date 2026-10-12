import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../api/axios';
import { Card, Button, Badge, Spinner, Modal, Field, EmptyState } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { money, fmtDate, fmtDateTime } from '../utils/format';
import { barcodeSvg, qrSvg, classifyBarcode } from '../utils/barcodeRender';
import { useBarcodeScanner } from '../utils/barcode';

const FIELD_DEFS = [
  { key: 'brandName', label: 'Brand', fontSize: 8, align: 'center' },
  { key: 'productName', label: 'Product Name', fontSize: 9, align: 'center', bold: true },
  { key: 'variant', label: 'Variant / Size', fontSize: 8, align: 'center' },
  { key: 'barcode', label: 'Barcode', fontSize: 8, align: 'center', isBarcode: true },
  { key: 'sku', label: 'SKU', fontSize: 8, align: 'center' },
  { key: 'categoryName', label: 'Category', fontSize: 7, align: 'center' },
  { key: 'unit', label: 'Unit', fontSize: 7, align: 'center' },
  { key: 'mrp', label: 'MRP', fontSize: 9, align: 'center' },
  { key: 'sellingPrice', label: 'Selling Price', fontSize: 13, align: 'center', bold: true },
  { key: 'offerPrice', label: 'Offer Price', fontSize: 11, align: 'center', bold: true },
  { key: 'batchNo', label: 'Batch No', fontSize: 7, align: 'center' },
  { key: 'manufacturingDate', label: 'Mfg Date', fontSize: 7, align: 'center' },
  { key: 'expiryDate', label: 'Expiry Date', fontSize: 7, align: 'center' },
  { key: 'qr', label: 'QR Code', fontSize: 8, align: 'center', isQr: true },
];

const defaultFields = () =>
  FIELD_DEFS.map((f, i) => ({
    key: f.key,
    enabled: ['productName', 'barcode', 'sellingPrice'].includes(f.key),
    order: i,
    fontSize: f.fontSize,
    align: f.align,
    bold: !!f.bold,
  }));

const emptyTemplate = () => ({
  name: 'New Template',
  preset: '50x25',
  size: { widthMm: 50, heightMm: 25 },
  columns: 1,
  barcodeType: 'auto',
  showQr: false,
  showBorder: false,
  isDefault: false,
  fields: defaultFields(),
});

function fieldText(it, key) {
  switch (key) {
    case 'brandName': return it.brandName || '';
    case 'productName': return it.name || '';
    case 'variant': return [it.variant, it.size, it.color].filter(Boolean).join(' ');
    case 'sku': return it.sku || '';
    case 'categoryName': return it.categoryName || '';
    case 'unit': return it.unit || '';
    case 'mrp': return it.mrp ? `MRP ${money(it.mrp)}` : '';
    case 'sellingPrice': return money(it.sellingPrice);
    case 'offerPrice': return it.offerPrice ? `Offer ${money(it.offerPrice)}` : '';
    case 'batchNo': return it.batchNo ? `Batch ${it.batchNo}` : '';
    case 'manufacturingDate': return it.manufacturingDate ? `Mfg ${fmtDate(it.manufacturingDate)}` : '';
    case 'expiryDate': return it.expiryDate ? `Exp ${fmtDate(it.expiryDate)}` : '';
    default: return '';
  }
}

function barcodeForTemplate(it, template) {
  const value = it.barcode || it.sku || it.clientId || '';
  if (!value) return '';
  const cls = classifyBarcode(value);
  const fmt = template.barcodeType && template.barcodeType !== 'auto' ? template.barcodeType : cls.format;
  if (fmt === 'none') return '';
  if (fmt === 'ean13' && cls.validEan) return barcodeSvg(value, { showText: true, moduleWidth: 1.7, height: 34, fontSize: 8 });
  return barcodeSvg(value, { showText: true, moduleWidth: 1.3, height: 34, fontSize: 7 });
}

function renderLabel(it, template) {
  const fields = [...(template.fields || [])].filter((f) => f.enabled).sort((a, b) => a.order - b.order);
  const parts = fields
    .map((f) => {
      const def = FIELD_DEFS.find((d) => d.key === f.key);
      const style = `font-size:${f.fontSize || 8}px;text-align:${f.align || 'center'};font-weight:${f.bold ? 700 : 400};`;
      if (def?.isBarcode) {
        const svg = barcodeForTemplate(it, template);
        return svg ? `<div class="lbl-bc" style="${style}">${svg}</div>` : '';
      }
      if (def?.isQr) {
        return it._qr ? `<div class="lbl-qr" style="${style}">${it._qr}</div>` : '';
      }
      const text = fieldText(it, f.key);
      return text ? `<div class="lbl-f" style="${style}">${escapeHtml(text)}</div>` : '';
    })
    .filter(Boolean)
    .join('');
  return `<div class="lbl-inner">${parts}</div>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function enrichItems(items, template) {
  const wantsQr = template.showQr || (template.fields || []).some((f) => f.key === 'qr' && f.enabled);
  if (!wantsQr) return items;
  return Promise.all(
    items.map(async (it) => {
      const payload = it.barcode || it.sku || it.clientId || it.name || '';
      return { ...it, _qr: await qrSvg(payload, { width: 90 }) };
    })
  );
}

function buildPrintHtml(labels, template, business) {
  const { widthMm, heightMm } = template.size;
  const columns = template.columns || 1;
  const css = `
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, 'Segoe UI', sans-serif; color: #000; }
    .lbl { width: ${widthMm}mm; height: ${heightMm}mm; padding: 1mm; overflow: hidden; ${template.showBorder ? 'border: 1px dashed #999;' : ''} page-break-inside: avoid; }
    .lbl-inner { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 0.4mm; }
    .lbl-f { line-height: 1.05; }
    .lbl-bc svg, .lbl-qr svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    .lbl-qr svg { width: 14mm; }
    ${columns > 1
      ? `@page { size: A4; margin: 6mm; } .grid { display: grid; grid-template-columns: repeat(${columns}, ${widthMm}mm); gap: 2mm; }`
      : `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; } .grid { display: block; }`}
  `;
  const body = labels.map((l) => `<div class="lbl">${renderLabel(l, template)}</div>`).join('');
  const biz = business?.businessName ? `<div style="text-align:center;font-size:9px;padding-bottom:2mm">${escapeHtml(business.businessName)}</div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>${css}</style></head>
    <body>${biz}<div class="grid">${body}</div>
    <script>window.onload=function(){window.print();};</script></body></html>`;
}

export default function LabelPrinting() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canPrices = hasPermission('labels.prices');
  const canTemplate = hasPermission('labels.template');

  const [tab, setTab] = useState('print');
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [presets, setPresets] = useState([]);
  const [business, setBusiness] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState({});
  const [templateId, setTemplateId] = useState('');
  const [editing, setEditing] = useState(null);
  const [savingTpl, setSavingTpl] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [printing, setPrinting] = useState(false);

  const activeTemplate = useMemo(
    () => templates.find((t) => t._id === templateId) || templates[0] || null,
    [templates, templateId]
  );

  const loadProducts = useCallback(async () => {
    try {
      const res = await api.get('/labels/products', { params: { search, category: category || undefined, limit: 200 } });
      setProducts(res.data.data);
    } catch (err) {
      setProducts([]);
      toast(err.response?.data?.message || err.message, 'error');
    }
  }, [search, category, toast]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get('/labels/templates');
      setTemplates(res.data.data || []);
    } catch {
      setTemplates([]);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await api.get('/labels/logs');
      setLogs(res.data.data || []);
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadTemplates();
    loadLogs();
    api.get('/categories').then((r) => setCategories(r.data.data || [])).catch(() => {});
    api.get('/labels/presets').then((r) => setPresets(r.data.data || [])).catch(() => {});
    api.get('/settings').then((r) => setBusiness(r.data?.data || null)).catch(() => {});
  }, [loadTemplates, loadLogs]);

  const toggleSelect = (p) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[p._id]) delete next[p._id];
      else next[p._id] = { product: p, qty: 1 };
      return next;
    });
  };

  const setQty = (id, qty) => {
    setSelected((prev) => ({ ...prev, [id]: { ...prev[id], qty: Math.max(1, Number(qty) || 1) } }));
  };

  const selectedList = Object.values(selected);
  const totalLabels = selectedList.reduce((a, s) => a + s.qty, 0);

  const doPrint = async () => {
    if (!activeTemplate) {
      toast('Create a label template first', 'error');
      return;
    }
    if (selectedList.length === 0) {
      toast('Select at least one product', 'error');
      return;
    }
    setPrinting(true);
    try {
      const flat = [];
      selectedList.forEach((s) => {
        const item = s.product;
        for (let i = 0; i < s.qty; i += 1) flat.push(item);
      });
      const enriched = await enrichItems(flat, activeTemplate);
      const html = buildPrintHtml(enriched, activeTemplate, business);
      const win = window.open('', '_blank', 'width=820,height=900');
      if (!win) {
        toast('Please allow popups to print labels', 'error');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();

      await api.post('/labels/logs', {
        template: activeTemplate._id,
        templateName: activeTemplate.name,
        mode: 'selection',
        items: selectedList.map((s) => ({
          product: s.product._id,
          productClientId: s.product.clientId,
          name: s.product.name,
          sku: s.product.sku,
          barcode: s.product.barcode,
          qty: s.qty,
        })),
      });
      toast(`Sent ${totalLabels} labels to printer`, 'success');
      loadLogs();
    } catch (err) {
      toast(err.response?.data?.message || err.message, 'error');
    } finally {
      setPrinting(false);
    }
  };

  const doLookup = async (code) => {
    const value = (code || lookupCode).trim();
    if (!value) return;
    setLookupCode(value);
    try {
      const res = await api.get(`/labels/lookup/${encodeURIComponent(value)}`);
      setLookupResult(res.data.data);
    } catch (err) {
      setLookupResult(null);
      toast(err.response?.data?.message || 'No product matches this code', 'error');
    }
  };

  useBarcodeScanner((code) => {
    if (tab === 'lookup') doLookup(code);
  });

  const saveTemplate = async () => {
    if (!editing.name) {
      toast('Template name is required', 'error');
      return;
    }
    setSavingTpl(true);
    const payload = {
      name: editing.name,
      preset: editing.preset,
      size: editing.size,
      columns: Number(editing.columns) || 1,
      barcodeType: editing.barcodeType,
      showQr: !!editing.showQr,
      showBorder: !!editing.showBorder,
      isDefault: !!editing.isDefault,
      fields: editing.fields,
    };
    try {
      if (editing._id) await api.put(`/labels/templates/${editing._id}`, payload);
      else await api.post('/labels/templates', payload);
      toast('Template saved', 'success');
      setEditing(null);
      await loadTemplates();
    } catch (err) {
      toast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSavingTpl(false);
    }
  };

  const deleteTemplate = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await api.delete(`/labels/templates/${t._id}`);
      toast('Template deleted', 'success');
      loadTemplates();
    } catch (err) {
      toast(err.response?.data?.message || err.message, 'error');
    }
  };

  const applyPreset = (preset) => {
    const p = presets.find((x) => x.preset === preset);
    if (!p) return;
    setEditing((e) => ({ ...e, preset, size: { widthMm: p.widthMm, heightMm: p.heightMm }, columns: p.columns || 1 }));
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Label Printing</h2>
        <div className="flex gap-8">
          <Button variant={tab === 'print' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('print')}>Print</Button>
          <Button variant={tab === 'templates' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('templates')}>Templates</Button>
          <Button variant={tab === 'lookup' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('lookup')}>Lookup</Button>
          <Button variant={tab === 'history' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('history')}>History</Button>
        </div>
      </div>

      {tab === 'print' && (
        <div className="grid-2" style={{ alignItems: 'flex-start' }}>
          <Card title="Choose Products">
            <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap' }}>
              <input className="input" placeholder="Search name / SKU / barcode…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ maxWidth: 180 }}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>

            {products === null ? (
              <Spinner />
            ) : products.length === 0 ? (
              <EmptyState icon="🏷️" title="No products" sub="Add products to print labels" />
            ) : (
              <div style={{ maxHeight: 460, overflow: 'auto' }}>
                {products.map((p) => (
                  <label key={p._id} className="flex gap-8" style={{ alignItems: 'center', padding: '8px 6px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!selected[p._id]} onChange={() => toggleSelect(p)} />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span className="muted small"> · {p.sku} {p.barcode ? `· ${p.barcode}` : ''}</span>
                    </span>
                    {canPrices && <span className="muted small">{money(p.sellingPrice)}</span>}
                    <Badge tone={p.barcodeFormat === 'ean13' ? 'success' : p.barcode ? 'warning' : 'neutral'}>{p.barcodeFormat}</Badge>
                  </label>
                ))}
              </div>
            )}
          </Card>

          <Card title="Print Queue">
            <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="select" value={templateId || activeTemplate?._id || ''} onChange={(e) => setTemplateId(e.target.value)} style={{ maxWidth: 220 }}>
                {templates.length === 0 && <option>No templates</option>}
                {templates.map((t) => <option key={t._id} value={t._id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
              </select>
              {canTemplate && <Button size="sm" variant="ghost" onClick={() => setEditing(templates[0] ? { ...emptyTemplate(), ...templates[0] } : emptyTemplate())}>＋ New / Edit</Button>}
            </div>

            {selectedList.length === 0 ? (
              <EmptyState icon="🖨️" title="Nothing queued" sub="Tick products on the left to add labels" />
            ) : (
              <>
                <table className="table">
                  <thead><tr><th>Product</th><th>Barcode</th><th style={{ width: 90 }}>Labels</th></tr></thead>
                  <tbody>
                    {selectedList.map(({ product, qty }) => (
                      <tr key={product._id}>
                        <td>{product.name}</td>
                        <td className="muted small">{product.barcode || product.sku}</td>
                        <td><input className="input" type="number" min="1" style={{ width: 70 }} value={qty} onChange={(e) => setQty(product._id, e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-16">
                  <div className="muted small mb-8">Preview</div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'center', background: '#fff' }}>
                    {activeTemplate && (
                      <div
                        style={{ width: `${activeTemplate.size.widthMm}mm`, height: `${activeTemplate.size.heightMm}mm`, border: '1px dashed #cbd5e1', overflow: 'hidden' }}
                        dangerouslySetInnerHTML={{ __html: renderLabel(selectedList[0].product, activeTemplate) }}
                      />
                    )}
                  </div>
                </div>
                <div className="flex-between mt-16">
                  <span><b>{totalLabels}</b> labels</span>
                  <div className="flex gap-8">
                    <Button variant="ghost" onClick={() => setSelected({})}>Clear</Button>
                    <Button onClick={doPrint} disabled={printing}>{printing ? 'Preparing…' : '🖨️ Print Labels'}</Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {tab === 'templates' && (
        <Card title="Label Templates" action={canTemplate && <Button size="sm" onClick={() => setEditing(emptyTemplate())}>＋ New Template</Button>}>
          {templates.length === 0 ? (
            <EmptyState icon="🏷️" title="No templates" sub="Create a template to control label size and fields" />
          ) : (
            <table className="table">
              <thead><tr><th>Name</th><th>Size</th><th>Columns</th><th>Barcode</th><th>Default</th><th></th></tr></thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t._id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td className="muted">{t.size.widthMm} × {t.size.heightMm} mm</td>
                    <td>{t.columns || 1}</td>
                    <td>{t.barcodeType || 'auto'}{t.showQr ? ' + QR' : ''}</td>
                    <td>{t.isDefault ? <Badge tone="success">Default</Badge> : '—'}</td>
                    <td>
                      <div className="flex gap-8">
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ ...emptyTemplate(), ...t })}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => deleteTemplate(t)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'lookup' && (
        <Card title="Barcode Lookup">
          <div className="flex gap-8 mb-16" style={{ maxWidth: 480 }}>
            <input className="input" placeholder="Scan or type barcode / SKU…" value={lookupCode} onChange={(e) => setLookupCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doLookup()} />
            <Button onClick={() => doLookup()}>Lookup</Button>
          </div>
          {lookupResult ? (
            <div style={{ maxWidth: 480 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{lookupResult.name}</div>
              <div className="muted small mb-8">{lookupResult.sku} · {lookupResult.categoryName || 'No category'}</div>
              <div className="flex gap-8 mb-16">
                <Badge tone={lookupResult.barcodeFormat === 'ean13' ? 'success' : 'warning'}>{lookupResult.barcodeFormat}</Badge>
                <Badge tone="neutral">Stock {lookupResult.stock}</Badge>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, display: 'inline-block' }} dangerouslySetInnerHTML={{ __html: barcodeSvg(lookupResult.barcode || lookupResult.sku, { showText: true, moduleWidth: 2 }) }} />
              {canPrices && <div className="mt-8" style={{ fontWeight: 700 }}>{money(lookupResult.sellingPrice)}</div>}
            </div>
          ) : (
            <p className="muted small">Scans are captured automatically while this tab is open.</p>
          )}
        </Card>
      )}

      {tab === 'history' && (
        <Card title="Print History">
          {logs.length === 0 ? (
            <EmptyState icon="🗂️" title="No prints yet" />
          ) : (
            <table className="table">
              <thead><tr><th>Date</th><th>Template</th><th>Mode</th><th>Items</th><th>Labels</th><th>By</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l._id}>
                    <td className="muted">{fmtDateTime(l.createdAt)}</td>
                    <td>{l.templateName || '—'}</td>
                    <td>{l.mode}</td>
                    <td>{l.itemCount}</td>
                    <td><Badge tone="info">{l.labelCount}</Badge></td>
                    <td className="muted">{l.userName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Modal open={!!editing} title={editing?._id ? 'Edit Template' : 'New Template'} onClose={() => setEditing(null)} width={720}>
        {editing && (
          <>
            <div className="form-row">
              <Field label="Template Name *"><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Preset">
                <select className="select" value={editing.preset} onChange={(e) => applyPreset(e.target.value)}>
                  <option value="custom">Custom</option>
                  {presets.map((p) => <option key={p.preset} value={p.preset}>{p.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="form-row-3">
              <Field label="Width (mm)"><input className="input" type="number" value={editing.size.widthMm} onChange={(e) => setEditing({ ...editing, preset: 'custom', size: { ...editing.size, widthMm: Number(e.target.value) } })} /></Field>
              <Field label="Height (mm)"><input className="input" type="number" value={editing.size.heightMm} onChange={(e) => setEditing({ ...editing, preset: 'custom', size: { ...editing.size, heightMm: Number(e.target.value) } })} /></Field>
              <Field label="Columns (A4)"><input className="input" type="number" min="1" max="6" value={editing.columns} onChange={(e) => setEditing({ ...editing, columns: Number(e.target.value) })} /></Field>
            </div>
            <div className="form-row">
              <Field label="Barcode Type">
                <select className="select" value={editing.barcodeType} onChange={(e) => setEditing({ ...editing, barcodeType: e.target.value })}>
                  <option value="auto">Auto (EAN-13 when valid, else Code 128)</option>
                  <option value="ean13">EAN-13</option>
                  <option value="code128">Code 128</option>
                  <option value="none">None</option>
                </select>
              </Field>
              <Field label="Options">
                <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                  <label className="flex gap-8" style={{ alignItems: 'center' }}><input type="checkbox" checked={editing.showQr} onChange={(e) => setEditing({ ...editing, showQr: e.target.checked })} /> QR</label>
                  <label className="flex gap-8" style={{ alignItems: 'center' }}><input type="checkbox" checked={editing.showBorder} onChange={(e) => setEditing({ ...editing, showBorder: e.target.checked })} /> Border</label>
                  <label className="flex gap-8" style={{ alignItems: 'center' }}><input type="checkbox" checked={editing.isDefault} onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} /> Default</label>
                </div>
              </Field>
            </div>

            <div className="muted small mb-8" style={{ fontWeight: 700 }}>Fields</div>
            <div className="grid-2" style={{ maxHeight: 260, overflow: 'auto' }}>
              {FIELD_DEFS.map((def) => {
                const f = editing.fields.find((x) => x.key === def.key) || { key: def.key, enabled: false, order: 99, fontSize: def.fontSize, align: def.align, bold: false };
                return (
                  <div key={def.key} className="flex gap-8" style={{ alignItems: 'center', border: '1px solid #f1f5f9', borderRadius: 8, padding: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!f.enabled}
                      onChange={(e) => {
                        const fields = editing.fields.filter((x) => x.key !== def.key);
                        fields.push({ ...f, key: def.key, enabled: e.target.checked });
                        setEditing({ ...editing, fields });
                      }}
                    />
                    <span style={{ flex: 1 }}>{def.label}</span>
                    <input className="input" type="number" min="6" max="24" style={{ width: 60 }} value={f.fontSize} onChange={(e) => {
                      const fields = editing.fields.map((x) => (x.key === def.key ? { ...x, fontSize: Number(e.target.value) } : x));
                      if (!fields.find((x) => x.key === def.key)) fields.push({ ...f, key: def.key, fontSize: Number(e.target.value) });
                      setEditing({ ...editing, fields });
                    }} />
                  </div>
                );
              })}
            </div>

            <Button className="btn-block mt-16" onClick={saveTemplate} disabled={savingTpl}>{savingTpl ? 'Saving…' : 'Save Template'}</Button>
          </>
        )}
      </Modal>
    </div>
  );
}
