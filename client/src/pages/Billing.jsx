import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import api from '../api/axios';
import db from '../db';
import {
  findProductByBarcodeLocal,
  saveSaleOffline,
  getAllProducts,
} from '../db/offlineService';
import { useBarcodeScanner, looksLikeBarcode } from '../utils/barcode';
import { computeTotals, lineTotal } from '../utils/gst';
import { money } from '../utils/format';
import { getDeviceId } from '../utils/license';
import { useToast } from '../context/ToastContext';
import { useSync } from '../context/SyncContext';
import { Button, Card, Modal, Field, Badge } from '../components/ui';
import PaymentModal from '../components/Billing/PaymentModal';
import InvoicePreview from '../components/Billing/InvoicePreview';
import { printInvoice } from '../utils/print';

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'beverages', name: 'Beverages' },
  { id: 'grocery', name: 'Grocery' },
  { id: 'snacks', name: 'Snacks' },
  { id: 'dairy', name: 'Dairy' },
  { id: 'personal-care', name: 'Personal Care' },
  { id: 'household', name: 'Household' },
];

function formatCategoryName(cat) {
  if (!cat) return 'Uncategorized';
  const map = {
    beverages: 'Beverages',
    grocery: 'Grocery',
    snacks: 'Snacks',
    dairy: 'Dairy',
    'personal-care': 'Personal Care',
    household: 'Household',
  };
  return map[cat.toLowerCase()] || cat;
}

function getPlaceholderImage(category) {
  const placeholders = {
    beverages: '🥤',
    grocery: '🛒',
    snacks: '🍿',
    dairy: '🥛',
    'personal-care': '🧴',
    household: '🧹',
  };
  return placeholders[category?.toLowerCase()] || '📦';
}

export default function Billing() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
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
  const [activeCategory, setActiveCategory] = useState('all');
  const [scanInput, setScanInput] = useState('');
  const [recentItems, setRecentItems] = useState([]);
  const [priceCheckMode, setPriceCheckMode] = useState(false);
  const [priceCheckProduct, setPriceCheckProduct] = useState(null);
  const searchRef = useRef(null);
  const scanRef = useRef(null);
  const { toast } = useToast();
  const sync = useSync();
  const online = sync.status !== 'OFFLINE';
  const user = JSON.parse(localStorage.getItem('pos_user') || '{}');

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

  const loadCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data);
    } catch {
      setCategories([]);
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
    } catch { }
  }, []);

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadCustomers();
    loadSettings();
    const iv = setInterval(loadProducts, 60000);
    return () => clearInterval(iv);
  }, [loadProducts, loadCategories, loadCustomers, loadSettings]);

  const filtered = useMemo(() => {
    let result = products.filter(p => p.active !== false);
    if (activeCategory !== 'all') {
      const catName = formatCategoryName(activeCategory).toLowerCase();
      result = result.filter(p => (p.categoryName || '').toLowerCase() === catName);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.sku || '').toLowerCase().includes(q) ||
          String(p.barcode || '').toLowerCase().includes(q)
      );
    }
    return result.slice(0, 60);
  }, [products, query, activeCategory]);

  const handleScan = useCallback(
    (code) => {
      if (looksLikeBarcode(code) || code.length >= 6) {
        const found = findProductByBarcodeLocal(products, code);
        if (found) {
          addToCart(found);
          toast(`Scanned: ${found.name}`, 'info');
          setScanInput('');
        } else {
          toast(`No product for barcode: ${code}`, 'error');
        }
      }
    },
    [products]
  );

  useBarcodeScanner(handleScan, { timeout: 60 });

  const handleScanInput = (e) => {
    const value = e.target.value;
    setScanInput(value);
    if (value.length >= 8 && (value.includes('\n') || value.includes('\r') || looksLikeBarcode(value))) {
      handleScan(value.replace(/[\n\r]/g, ''));
    }
  };

  const addToCart = (p) => {
    setCart((c) => {
      const idx = c.findIndex((x) => x.sku === p.sku);
      if (idx >= 0) {
        const copy = [...c];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      const newItem = {
        product: p._id,
        sku: p.sku,
        name: p.name,
        barcode: p.barcode,
        price: p.sellingPrice,
        gstRate: p.gstRate || 0,
        purchasePrice: p.purchasePrice || 0,
        categoryName: p.categoryName,
        image: p.image,
        qty: 1,
        lineDiscount: 0,
      };
      setRecentItems((prev) => {
        const filtered = prev.filter((r) => r.sku !== p.sku);
        return [newItem, ...filtered].slice(0, 5);
      });
      return [...c, newItem];
    });
    setQuery('');
    searchRef.current?.focus();
  };

  const addRecentItem = (item) => {
    const p = products.find((prod) => prod.sku === item.sku);
    if (p) addToCart(p);
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
    const cashierName = user.name || 'cashier';

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

  const holdBill = () => {
    if (cart.length === 0) {
      toast('Cart is empty', 'error');
      return;
    }
    toast('Bill held (feature coming soon)', 'info');
  };

  const parkBill = () => {
    if (cart.length === 0) {
      toast('Cart is empty', 'error');
      return;
    }
    toast('Bill parked (feature coming soon)', 'info');
  };

  const printBill = () => {
    if (cart.length === 0) {
      toast('Cart is empty', 'error');
      return;
    }
    toast('Print preview (feature coming soon)', 'info');
  };

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
      } else if (e.key === 'F7') {
        e.preventDefault();
        holdBill();
      } else if (e.key === 'F8') {
        e.preventDefault();
        parkBill();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart.length]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const outletName = settings.outletName || 'Main Outlet';

  return (
    <div className="pos-layout">
      {/* TOP BAR */}
      <header className="pos-topbar">
        <div className="topbar-left">
          <span className="pos-logo">NiteshPro POS</span>
        </div>
        <div className="topbar-center">
          <div className="search-box-large">
            <input
              ref={searchRef}
              className="search-input"
              placeholder="Search product by name, SKU, or barcode..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <span className="search-icon">🔍</span>
          </div>
        </div>
        <div className="topbar-right">
          <Button variant="ghost" size="sm" onClick={holdBill} title="F7 - Hold Bill">
            ⏸ Hold
          </Button>
          <Button variant="ghost" size="sm" onClick={parkBill} title="F8 - Park Bill">
            🅿 Park
          </Button>
          <Button variant="ghost" size="sm" onClick={printBill} title="Print">
            🖨 Print
          </Button>
          <div className="user-profile">
            <span className="user-role">{user.role || 'Cashier'}</span>
            <span className="user-name">{user.name || 'Admin'}</span>
            <div className="user-avatar">👤</div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="pos-main">
        {/* LEFT: CART / BILLING AREA */}
        <aside className="pos-left">
          <div className="billing-card">
            <div className="billing-header">
              <h3>Walk-in Customer</h3>
              {customer && (
                <div className="customer-info">
                  <span className="customer-name">{customer.name}</span>
                  {customer.mobile && <span className="customer-mobile">{customer.mobile}</span>}
                  <button className="btn-remove-customer" onClick={() => setCustomer(null)}>✕</button>
                </div>
              )}
              {!customer && (
                <Button variant="ghost" size="sm" onClick={() => setShowCustomerModal(true)} className="select-customer-btn">
                  + Select / Add Customer
                </Button>
              )}
            </div>

            <div className="cart-items">
              {cart.length === 0 ? (
                <div className="empty-cart">
                  <div className="empty-icon">🛒</div>
                  <div className="empty-text">Cart is empty</div>
                  <div className="empty-sub">Search products or scan barcode to add items</div>
                </div>
              ) : (
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ width: 80 }}>Price</th>
                      <th style={{ width: 80 }}>Qty</th>
                      <th style={{ width: 80 }}>Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((it, i) => (
                      <tr key={`${it.sku}-${i}`}>
                        <td>
                          <div className="cart-item-name">{it.name}</div>
                          <div className="cart-item-sku">{it.sku}</div>
                        </td>
                        <td>{money(it.price)}</td>
                        <td>
                          <div className="qty-control">
                            <button onClick={() => dec(i)}>-</button>
                            <span>{it.qty}</span>
                            <button onClick={() => inc(i)}>+</button>
                          </div>
                        </td>
                        <td className="cart-item-total">{money(lineTotal(it))}</td>
                        <td>
                          <button className="btn-remove" onClick={() => remove(i)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="billing-totals">
              <div className="totals-row">
                <span>Subtotal</span>
                <span>{money(totals.subtotal)}</span>
              </div>
              <div className="totals-row">
                <span>Discount (₹)</span>
                <input
                  type="number"
                  min="0"
                  className="discount-input"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="totals-row">
                <span>Taxable</span>
                <span>{money(totals.taxable)}</span>
              </div>
              <div className="totals-row">
                <span>GST</span>
                <span>{money(totals.gstTotal)}</span>
              </div>
              <div className="totals-row grand-total">
                <span>Grand Total</span>
                <span>{money(totals.total)}</span>
              </div>
              <div className="totals-row paid-row">
                <span>Paid Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="paid-input"
                  placeholder="0.00"
                />
              </div>
              <div className="totals-row change-row">
                <span>Change</span>
                <span className="change-amount">₹0.00</span>
              </div>
            </div>

            <Button
              className="pay-button btn-block"
              disabled={cart.length === 0}
              onClick={() => setShowPayment(true)}
            >
              💳 Pay & Print (F9) — {money(totals.total)}
            </Button>
          </div>
        </aside>

        {/* RIGHT: PRODUCTS GALLERY */}
        <main className="pos-right">
          <div className="products-card">
            <div className="category-tabs">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`cat-tab ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => { setActiveCategory(cat.id); setQuery(''); }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="products-grid">
              {filtered.length === 0 ? (
                <div className="no-products">No products in this category</div>
              ) : (
                filtered.map((p) => (
                  <div
                    key={p.sku}
                    className="product-card"
                    onClick={() => addToCart(p)}
                    style={{ borderLeftColor: p.isLowStock ? 'var(--danger)' : 'transparent' }}
                  >
                    <div className="product-image">
                      {p.image ? (
                        <img src={p.image} alt={p.name} onError={(e) => e.currentTarget.style.display = 'none'} />
                      ) : (
                        <span className="placeholder">{getPlaceholderImage(p.categoryName)}</span>
                      )}
                    </div>
                    <div className="product-info">
                      <div className="product-name">{p.name}</div>
                      <div className="product-price">{money(p.sellingPrice)}</div>
                      <div className="product-barcode">{p.barcode || `SKU: ${p.sku}`}</div>
                      <div className="product-stock" style={{ color: p.isLowStock ? 'var(--danger)' : 'var(--text-muted)' }}>
                        Stock: {p.stock}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* BOTTOM BAR */}
      <footer className="pos-bottombar">
        <div className="bottombar-left">
          <div className="scan-box">
            <label>Scan Barcode</label>
            <input
              ref={scanRef}
              type="text"
              className="scan-input"
              placeholder="Scan or type barcode..."
              value={scanInput}
              onChange={handleScanInput}
              onKeyDown={(e) => { if (e.key === 'Enter') handleScan(scanInput); }}
            />
          </div>
        </div>
        <div className="bottombar-center">
          <Button variant="ghost" size="sm" onClick={() => setPriceCheckMode(!priceCheckMode)}>
            {priceCheckMode ? '✕ Exit Price Check' : '🔍 Price Check'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { /* recent items */ }}>
            🕐 Recent Items
          </Button>
        </div>
        <div className="bottombar-right">
          <div className="footer-info">
            <div>{dateStr} | {timeStr}</div>
            <div className="outlet-name">{outletName}</div>
          </div>
        </div>
      </footer>

      {/* Customer selection modal */}
      <Modal open={showCustomerModal} title="Select or Add Customer" onClose={() => setShowCustomerModal(false)}>
        <Field label="Search customer">
          <input className="input" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Name or mobile…" />
        </Field>
        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 14 }}>
          {customerOptions.map((c) => (
            <div
              key={c.id}
              onClick={() => { setCustomer(c); setShowCustomerModal(false); setCustomerSearch(''); }}
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
            <Field label="Name *"><input className="input" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} /></Field>
            <Field label="Mobile"><input className="input" value={newCustomer.mobile} onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })} /></Field>
            <Field label="GST Number"><input className="input" value={newCustomer.gstNumber} onChange={(e) => setNewCustomer({ ...newCustomer, gstNumber: e.target.value })} /></Field>
          </div>
          <Field label="Address"><input className="input" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} /></Field>
          <Button className="btn-block" onClick={saveCustomer}>Save Customer</Button>
        </div>
      </Modal>

      {/* Price Check Modal */}
      {priceCheckMode && priceCheckProduct && (
        <Modal open={true} title="Price Check" onClose={() => { setPriceCheckMode(false); setPriceCheckProduct(null); }}>
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div className="product-image" style={{ width: 120, height: 120, margin: '0 auto 16px' }}>
              {priceCheckProduct.image ? (
                <img src={priceCheckProduct.image} alt={priceCheckProduct.name} />
              ) : (
                <span className="placeholder" style={{ fontSize: 48 }}>{getPlaceholderImage(priceCheckProduct.categoryName)}</span>
              )}
            </div>
            <h3 style={{ marginBottom: 8 }}>{priceCheckProduct.name}</h3>
            <div className="muted small mb-8">{priceCheckProduct.barcode || `SKU: ${priceCheckProduct.sku}`}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{money(priceCheckProduct.sellingPrice)}</div>
            <div className="muted small mt-8">GST: {priceCheckProduct.gstRate}% | Stock: {priceCheckProduct.stock}</div>
          </div>
        </Modal>
      )}

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