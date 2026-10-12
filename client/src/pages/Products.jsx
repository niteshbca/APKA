import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import db from '../db';
import { queueOperation, supersedePendingOps } from '../db/offlineService';
import { useToast } from '../context/ToastContext';
import { useSync } from '../context/SyncContext';
import { Button, Card, Modal, Field, Badge, EmptyState, Spinner, Pagination } from '../components/ui';
import ImageField from '../components/ImageField';
import { money, uid } from '../utils/format';

const emptyForm = { name: '', sku: '', barcode: '', category: '', purchasePrice: '', sellingPrice: '', gstRate: '0', stock: '0', minStock: '5', image: '' };

export default function Products() {
  const [rows, setRows] = useState(null);
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();
  const sync = useSync();
  const online = sync.status !== 'OFFLINE';

  const load = useCallback(async () => {
    const params = { page, limit: 20, search, category: categoryFilter, lowStock: lowStockOnly ? 'true' : undefined };
    try {
      const res = await api.get('/products', { params });
      setRows(res.data.data);
      setTotal(res.data.total);
      await db.putMany('products', res.data.data);
    } catch {
      // offline fallback
      const all = await db.getAll('products');
      const catName = categories.find((c) => c._id === categoryFilter)?.name;
      const filtered = all.filter((p) => {
        if (lowStockOnly && !p.isLowStock) return false;
        if (categoryFilter && p.category !== categoryFilter && (p.categoryName || '') !== (catName || '\u0000')) return false;
        if (search) {
          const q = search.toLowerCase();
          if (![p.name, p.sku, p.barcode].some((v) => String(v || '').toLowerCase().includes(q))) return false;
        }
        return true;
      });
      setRows(filtered);
      setTotal(filtered.length);
    }
  }, [page, search, categoryFilter, lowStockOnly, categories]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.data)).catch(() => {});
  }, []);

  const save = async () => {
    if (!form.name.trim() || !form.sku.trim()) {
      toast('Name and SKU are required', 'error');
      return;
    }
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      category: form.category || null,
      purchasePrice: Number(form.purchasePrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      gstRate: Number(form.gstRate) || 0,
      stock: Number(form.stock) || 0,
      minStock: Number(form.minStock) || 0,
      image: form.image || '',
    };

    const saveLocal = async () => {
      if (editingId) {
        const all = await db.getAll('products');
        const existing = all.find((p) => p._id === editingId || p.clientId === editingId || p.sku === payload.sku);
        await db.put('products', {
          ...(existing || {}),
          ...payload,
          _id: existing?._id || `local-${uid('prod')}`,
          clientId: existing?.clientId || uid('prod'),
          isLowStock: payload.stock <= payload.minStock,
          updatedAt: new Date().toISOString(),
        });
        await queueOperation('product_update', { id: editingId, clientId: existing?.clientId, ...payload });
      } else {
        const clientId = uid('prod');
        await db.put('products', {
          ...payload,
          _id: `local-${clientId}`,
          clientId,
          active: true,
          isLowStock: payload.stock <= payload.minStock,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await queueOperation('product_create', { clientId, ...payload });
      }
    };

    try {
      if (online) {
        if (editingId) await api.put(`/products/${editingId}`, payload);
        else await api.post('/products', payload);
        toast(editingId ? 'Product updated' : 'Product created', 'success');
      } else {
        await saveLocal();
        toast(editingId ? 'Saved locally — will sync' : 'Created locally — will sync', 'success');
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      if (err && !err.response) {
        try {
          await saveLocal();
          toast('Saved locally — will sync', 'success');
          setShowModal(false);
          setForm(emptyForm);
          setEditingId(null);
          load();
          return;
        } catch (e2) {
          toast(e2.message, 'error');
          return;
        }
      }
      toast(err.response?.data?.message || err.message, 'error');
    }
  };

  const edit = (p) => {
    setEditingId(p._id);
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      category: p.category || '',
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      gstRate: p.gstRate,
      stock: p.stock,
      minStock: p.minStock,
      image: p.image || '',
    });
    setShowModal(true);
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete product "${p.name}"?`)) return;
    const isLocalOnly = String(p._id || '').startsWith('local-');
    try {
      await db.delete('products', p.sku);
      await supersedePendingOps(p.clientId);
      let serverOk = false;
      if (online && !isLocalOnly) {
        try {
          await api.delete(`/products/${p._id}`);
          serverOk = true;
        } catch (e) {
          serverOk = false;
        }
      }
      if (!serverOk && !isLocalOnly) {
        await queueOperation('product_delete', { id: p._id, clientId: p.clientId });
      }
      toast(serverOk ? 'Product deleted' : 'Deleted locally — will sync', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.message || err.message, 'error');
    }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Products</h2>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowModal(true); }}>＋ Add Product</Button>
      </div>

      <Card>
        <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap' }}>
          <input className="input" placeholder="Search name / SKU / barcode…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} style={{ maxWidth: 320 }} />
          <select className="select" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} style={{ maxWidth: 200 }}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <label className="flex gap-8" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => { setLowStockOnly(e.target.checked); setPage(1); }} />
            Low stock only
          </label>
          {!online && <Badge tone="warning">Offline — showing local data</Badge>}
        </div>

        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="📦" title="No products" sub="Add your first product to start selling" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th><th>SKU</th><th>Barcode</th><th>Category</th><th>Purchase</th><th>Selling</th><th>GST</th><th>Stock</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p._id || p.sku}>
                  <td>
                    <div className="flex gap-8" style={{ alignItems: 'center' }}>
                      <span className="thumb">
                        {p.image ? <img src={p.image} alt={p.name} /> : <span className="thumb-empty">📦</span>}
                      </span>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                    </div>
                  </td>
                  <td className="muted">{p.sku}</td>
                  <td className="muted">{p.barcode || '—'}</td>
                  <td>{p.categoryName || '—'}</td>
                  <td>{money(p.purchasePrice)}</td>
                  <td>{money(p.sellingPrice)}</td>
                  <td>{p.gstRate}%</td>
                  <td>
                    <Badge tone={p.isLowStock ? 'danger' : 'success'}>{p.stock}</Badge>
                  </td>
                  <td>{p.active === false ? <Badge tone="neutral">Inactive</Badge> : <Badge tone="success">Active</Badge>}</td>
                  <td>
                    <div className="flex gap-8">
                      <Button size="sm" variant="ghost" onClick={() => edit(p)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => remove(p)}>Del</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > 0 && <Pagination page={page} total={total} limit={20} onPage={setPage} />}
      </Card>

      <Modal open={showModal} title={editingId ? 'Edit Product' : 'Add Product'} onClose={() => setShowModal(false)} width={640}>
        <div className="form-row">
          <Field label="Product Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="SKU *"><input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Barcode"><input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Optional — for scanner" /></Field>
          <Field label="Category">
            <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">None</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row-3">
          <Field label="Purchase Price"><input className="input" type="number" min="0" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} /></Field>
          <Field label="Selling Price *"><input className="input" type="number" min="0" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></Field>
          <Field label="GST %"><input className="input" type="number" min="0" max="100" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Opening Stock"><input className="input" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
          <Field label="Minimum Stock Alert"><input className="input" type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></Field>
        </div>
        <ImageField label="Product Image" value={form.image} onChange={(v) => setForm({ ...form, image: v })} toast={toast} />
        <Button className="btn-block" onClick={save}>{editingId ? 'Update Product' : 'Save Product'}</Button>
      </Modal>
    </div>
  );
}
