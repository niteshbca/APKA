import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import api from '../api/axios';
import db from '../db';
import {
  findProductByBarcodeLocal,
  saveSaleOffline,
  getAllProducts,
} from '../db/offlineService';
import { useBarcodeScanner, looksLikeBarcode } from '../utils/barcode';
import { computeTotals } from '../utils/gst';
import { money } from '../utils/format';
import { getDeviceId } from '../utils/license';
import { useToast } from '../context/ToastContext';
import { useSync } from '../context/SyncContext';
import { Button, Card, Modal, Field, Badge } from '../components/ui';
import CartTable from '../components/Billing/CartTable';
import PaymentModal from '../components/Billing/PaymentModal';
import InvoicePreview from '../components/Billing/InvoicePreview';
import { printInvoice } from '../utils/print';

export default function Billing() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('');
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '', gstNumber: '', address: '' });
  const [showPayment, setShowPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [settings, setSettings] = useState({});
  const searchRef = useRef(null);
  const { toast } = useToast();
  const sync = useSync();
  const online = sync.status !== 'OFFLINE';

  const loadProducts = useCallback(async () => {
    const local = await getAllProducts();
    if (local.length > 0) {
      setProducts(local);
      return;
    }
    try {
      const res = await api.get('/products', { params: { limit: 500 } });
      const list = res.data.data;
      await db.putMany('products', list);
      setProducts(list);
    } catch {
      setProducts([]);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    const local = await db.getAll('customers');
    if (local.length > 0) {
      setCustomers(local);
      return;
    }
    try {
      const res = await api.get('/customers', { params: { limit: 500 } });
      const list = res.data.data.map((c) => ({ ...c, id: c._id }));
      await db.putMany('customers', list);
      setCustomers(list);
    } catch {
      setCustomers([]);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const cached = await db.get('settings', 'business_settings');
    if (cached) setSettings(cached);
    try {
      const res = await api.get('/settings');
      const s = res.data.data;
      await db.put('settings', { key: 'business_settings', ...s });
      setSettings(s);
    } catch { /* offline: cached is fine */ }
  }, []);

  useEffect(() => {
    loadProducts();
    loadCustomers();
    loadSettings();
    const iv = setInterval(loadProducts, 60000);
    return () => clearInterval(iv);
  }, [loadProducts, loadCustomers, loadSettings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products.filter(
      (p) =>
        p.active !== false &&
        (String(p.name || '').toLowerCase().includes(q) ||
          String(p.sku || '').toLowerCase().includes(q) ||
          String(p.barcode || '').toLowerCase().includes(q))
    ).slice(0, 40);
  }, [products, query]);

  const handleScan = useCallback(
    (code) => {
      if (looksLikeBarcode(code) || code.length >= 6) {
        const found = findProductByBarcodeLocal(products, code);
        if (found) {
          addToCart(found);
          toast(`Scanned: ${found.name}`, 'info');
        } else {
          toast(`No product for barcode: ${code}`, 'error');
        }
      }
    },
    [products]
  );

  useBarcodeScanner(handleScan, { timeout: 60 });

  const addToCart = (p) => {
    setCart((c) => {
      const idx = c.findIndex((x) => x.sku === p.sku);
      if (idx >= 0) {
        const copy = [...c];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...c,
        {
          product: p._id,
          sku: p.sku,
          name: p.name,
          barcode: p.barcode,
          price: p.sellingPrice,
          gstRate: p.gstRate || 0,
          purchasePrice: p.purchasePrice || 0,
          qty: 1,
          lineDiscount: 0,
        },
      ];
    });
  };

  const inc = (i) => setCart((c) => c.map((x, idx) => (idx === i ? { ...x, qty: x.qty + 1 } : x)));
  const dec = (i) => setCart((c) => c.map((x, idx) => (idx === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)));
  const remove = (i) => setCart((c) => c.filter((_, idx) => idx !== i));
  const setLineDiscount = (i, v) => setCart((c) => c.map((x, idx) => (idx === i ? { ...x, lineDiscount: v } : x)));

  const totals = useMemo(() => computeTotals(cart, Number(discount) || 0), [cart, discount]);

  const customerOptions = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 10);
    return customers.filter((c) => String(c.name || '').toLowerCase().includes(q) || String(c.mobile || '').toLowerCase().includes(q)).slice(0, 10);
  }, [customers, customerSearch]);

  const saveCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast('Customer name is required', 'error');
      return;
    }
    try {
      const res = await api.post('/customers', newCustomer);
      const c = res.data.data;
      const mapped = { ...c, id: c._id };
      await db.put('customers', mapped);
      setCustomers((x) => [mapped, ...x]);
      setCustomer(mapped);
      setShowCustomerModal(false);
      setNewCustomer({ name: '', mobile: '', gstNumber: '', address: '' });
      toast('Customer saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const buildInvoiceRecord = (saleOrInvoice, extra = {}) => {
    const inv = {
      invoiceNo: saleOrInvoice.invoiceNo,
      businessName: settings.businessName,
      businessAddress: settings.address,
      businessGstin: settings.gstin,
      businessPhone: settings.phone,
      customerName: saleOrInvoice.customerName || 'Walk-in Customer',
      customerMobile: saleOrInvoice.customerMobile || '',
      customerGst: saleOrInvoice.customerGst || '',
      customerAddress: saleOrInvoice.customerAddress || '',
      items: saleOrInvoice.items,
      subtotal: saleOrInvoice.subtotal,
      discount: saleOrInvoice.discount,
      taxable: saleOrInvoice.taxable,
      gstTotal: saleOrInvoice.gstTotal,
      total: saleOrInvoice.total,
      paymentMode: saleOrInvoice.paymentMode,
      amountReceived: saleOrInvoice.amountReceived,
      changeDue: saleOrInvoice.changeDue,
      cashierName: saleOrInvoice.cashierName,
      createdAt: saleOrInvoice.createdAt,
      ...extra,
    };
    return inv;
  };

  const handleConfirmPayment = async (payment) => {
    if (cart.length === 0) {
      toast('Cart is empty', 'error');
      return;
    }
    setSubmitting(true);
    const deviceId = await getDeviceId();
    const cashierName = JSON.parse(localStorage.getItem('pos_user') || '{}').name || 'cashier';

    const base = {
      items: cart,
      discount: totals.discount,
      subtotal: totals.subtotal,
      taxable: totals.taxable,
      gstTotal: totals.gstTotal,
      total: totals.total,
      customerName: customer?.name || '',
      customerMobile: customer?.mobile || '',
      customerGst: customer?.gstNumber || '',
      customerAddress: customer?.address || '',
      paymentMode: payment.mode,
      amountReceived: payment.amountReceived,
      changeDue: payment.changeDue,
      cashierName,
      deviceId,
    };

    try {
      if (online) {
        const res = await api.post('/sales', base);
        const result = res.data.data;
        const invoiceRecord = buildInvoiceRecord(base, {
          invoiceNo: result.invoiceNo,
          createdAt: new Date().toISOString(),
        });
        await db.put('invoices', {
          invoiceNo: result.invoiceNo,
          clientSaleId: `server-${result.saleId}`,
          ...invoiceRecord,
        });
        // Update local stock for the just-sold items.
        for (const it of cart) {
          const local = await db.get('products', it.sku);
          if (local) {
            await db.put('products', { ...local, stock: Math.max(0, (local.stock || 0) - it.qty) });
          }
        }
        loadProducts();
        setPreview({ invoice: invoiceRecord, invoiceNo: result.invoiceNo, synced: true });
        toast(`Sale completed · ${result.invoiceNo}`, 'success');
      } else {
        const result = await saveSaleOffline({
          items: cart,
          discount: totals.discount,
          customer,
          paymentMode: payment.mode,
          amountReceived: payment.amountReceived,
          changeDue: payment.changeDue,
          cashierName,
          deviceId,
          businessName: settings.businessName,
        });
        const invoiceRecord = buildInvoiceRecord(result.invoice, { createdAt: result.invoice.createdAt });
        setPreview({ invoice: invoiceRecord, invoiceNo: result.invoice.invoiceNo, synced: false });
        toast('Offline sale saved · will sync when online', 'info');
      }
      setCart([]);
      setDiscount('');
      setCustomer(null);
      setQuery('');
      setShowPayment(false);
    } catch (err) {
      if (err.code === 'LICENSE_EXPIRED') {
        toast('License expired — billing blocked', 'error');
      } else {
        // Fall back to offline storage so billing never stops.
        try {
          const result = await saveSaleOffline({
            items: cart,
            discount: totals.discount,
            customer,
            paymentMode: payment.mode,
            amountReceived: payment.amountReceived,
            changeDue: payment.changeDue,
            cashierName,
            deviceId,
            businessName: settings.businessName,
          });
          const invoiceRecord = buildInvoiceRecord(result.invoice, { createdAt: result.invoice.createdAt });
          setPreview({ invoice: invoiceRecord, invoiceNo: result.invoice.invoiceNo, synced: false });
          setCart([]);
          setDiscount('');
          setCustomer(null);
          setQuery('');
          setShowPayment(false);
          toast('Server error — sale saved offline', 'info');
        } catch (err2) {
          toast(`Sale failed: ${err2.message}`, 'error');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const newBill = () => {
    setCart([]);
    setDiscount('');
    setCustomer(null);
    setQuery('');
    searchRef.current?.focus();
  };

  // Keyboard shortcuts: F2 search, F9 payment, F4 new bill, Enter adds first result when search focused
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setShowPayment(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        newBill();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart.length]);

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Billing Screen</h2>
        <div className="flex gap-8">
          <span className="kbd">F2 Search</span>
          <span className="kbd">F9 Pay</span>
          <span className="kbd">F4 New</span>
          {!online && <Badge tone="warning">Offline mode — sales saved locally</Badge>}
        </div>
      </div>

      <div className="billing-layout">
        {/* LEFT: product picker */}
        <Card title="Search Products" action={<Badge tone="info">{products.length} products</Badge>}>
          <div className="search-box">
            <input
              ref={searchRef}
              className="input"
              placeholder="Search by name, SKU, or scan barcode…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <span className="icon">🔍</span>
          </div>
          {query && (
            <div className="barcode-input small muted mt-8">
              Scans detected automatically — or press Enter to add first result.
            </div>
          )}
          <div style={{ maxHeight: 460, overflowY: 'auto', marginTop: 12 }}>
            {filtered.length === 0 && <div className="muted small">No products found</div>}
            {filtered.map((p) => (
              <div
                key={p.sku}
                onClick={() => addToCart(p)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  marginBottom: 6,
                  cursor: 'pointer',
                  background: '#fff',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="muted small">SKU: {p.sku} {p.barcode ? `· Barcode: ${p.barcode}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{money(p.sellingPrice)}</div>
                  <div className="small" style={{ color: p.isLowStock ? 'var(--danger)' : 'var(--text-muted)' }}>
                    Stock: {p.stock}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* RIGHT: cart + totals */}
        <div>
          <Card title="Current Bill">
            <div className="flex gap-8" style={{ marginBottom: 12 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowCustomerModal(true)}>
                {customer ? `Customer: ${customer.name}` : '＋ Select / Add Customer'}
              </Button>
              <Button variant="ghost" size="sm" onClick={newBill}>🗑 New Bill</Button>
            </div>

            {customer && (
              <div className="flex-between small mb-16" style={{ background: 'var(--primary-light)', padding: '8px 12px', borderRadius: 8 }}>
                <span><b>{customer.name}</b> {customer.mobile && `· ${customer.mobile}`}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setCustomer(null)}>✕</button>
              </div>
            )}

            <CartTable items={cart} onInc={inc} onDec={dec} onRemove={remove} onSetLineDiscount={setLineDiscount} />

            <div className="mt-16" style={{ width: 260, marginLeft: 'auto' }}>
              <div className="flex-between small"><span className="muted">Subtotal</span><span>{money(totals.subtotal)}</span></div>
              <div className="flex-between small mt-8">
                <span className="muted">Discount (₹)</span>
                <input
                  type="number"
                  min="0"
                  style={{ width: 100, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="flex-between small mt-8"><span className="muted">Taxable</span><span>{money(totals.taxable)}</span></div>
              <div className="flex-between small mt-8"><span className="muted">GST ({Object.keys(totals.gstBuckets).join(', ')}%)</span><span>{money(totals.gstTotal)}</span></div>
              <div className="flex-between mt-8" style={{ fontWeight: 800, fontSize: 20, borderTop: '2px solid var(--text)', paddingTop: 8 }}>
                <span>Grand Total</span><span>{money(totals.total)}</span>
              </div>
            </div>

            <Button
              className="btn-block mt-16"
              style={{ padding: 14, fontSize: 16 }}
              disabled={cart.length === 0}
              onClick={() => setShowPayment(true)}
            >
              💳 Charge {money(totals.total)} — Press F9
            </Button>
          </Card>
        </div>
      </div>

      {/* Customer selection modal */}
      <Modal open={showCustomerModal} title="Select or Add Customer" onClose={() => setShowCustomerModal(false)}>
        <Field label="Search customer">
          <input className="input" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Name or mobile…" />
        </Field>
        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 14 }}>
          {customerOptions.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                setCustomer(c);
                setShowCustomerModal(false);
                setCustomerSearch('');
              }}
              style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <b>{c.name}</b> {c.mobile && <span className="muted small">· {c.mobile}</span>}
            </div>
          ))}
          {customerOptions.length === 0 && <div className="muted small">No matches</div>}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="form-row-3">
            <Field label="Name *">
              <input className="input" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <input className="input" value={newCustomer.mobile} onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })} />
            </Field>
            <Field label="GST Number">
              <input className="input" value={newCustomer.gstNumber} onChange={(e) => setNewCustomer({ ...newCustomer, gstNumber: e.target.value })} />
            </Field>
          </div>
          <Field label="Address">
            <input className="input" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
          </Field>
          <Button className="btn-block" onClick={saveCustomer}>Save Customer</Button>
        </div>
      </Modal>

      <PaymentModal
        open={showPayment}
        totals={totals}
        onClose={() => setShowPayment(false)}
        onConfirm={handleConfirmPayment}
        submitting={submitting}
      />

      {preview && (
        <InvoicePreview
          invoice={preview.invoice}
          invoiceNo={preview.invoiceNo}
          settings={settings}
          synced={preview.synced}
          onClose={() => setPreview(null)}
          onPrintA4={(inv) => printInvoice(settings, inv, 'A4')}
          onPrintThermal={(inv) => printInvoice(settings, inv, 'thermal')}
        />
      )}
    </div>
  );
}
