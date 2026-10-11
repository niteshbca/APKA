import React from 'react';
import { money } from '../../utils/format';
import { Button } from '../ui';

export default function InvoicePreview({ invoice, settings, onClose, onPrintA4, onPrintThermal, synced, invoiceNo }) {
  const s = settings || {};
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div className="modal-title">🧾 Invoice {invoiceNo || invoice?.invoiceNo}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="print-area" style={{ fontFamily: 'Segoe UI, sans-serif' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{s.businessName || 'Business'}</div>
            <div className="small muted">{s.address}</div>
            <div className="small muted">Ph: {s.phone} · GSTIN: {s.gstin}</div>
          </div>
          <div className="flex-between small mb-16">
            <div>
              <b>Invoice No:</b> {invoiceNo || invoice?.invoiceNo}
              <br />
              <b>Date:</b> {new Date(invoice?.createdAt).toLocaleString()}
              <br />
              <b>Cashier:</b> {invoice?.cashierName}
            </div>
            <div style={{ textAlign: 'right' }}>
              <b>Customer:</b> {invoice?.customerName || 'Walk-in Customer'}
              <br />
              {invoice?.customerMobile && <><b>Mobile:</b> {invoice.customerMobile}<br /></>}
              {invoice?.customerGst && <><b>GSTIN:</b> {invoice.customerGst}</>}
            </div>
          </div>
          <table className="table" style={{ fontSize: 13 }}>
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Rate</th><th>GST</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
            </thead>
            <tbody>
              {(invoice?.items || []).map((it, i) => (
                <tr key={i}>
                  <td>{it.name}</td>
                  <td>{it.qty}</td>
                  <td>{money(it.price)}</td>
                  <td>{it.gstRate}%</td>
                  <td style={{ textAlign: 'right' }}>{money(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ width: 260, marginLeft: 'auto', marginTop: 10, fontSize: 13 }}>
            <div className="flex-between"><span>Subtotal</span><span>{money(invoice?.subtotal)}</span></div>
            {invoice?.discount ? <div className="flex-between"><span>Discount</span><span>-{money(invoice.discount)}</span></div> : null}
            <div className="flex-between"><span>Taxable</span><span>{money(invoice?.taxable)}</span></div>
            <div className="flex-between"><span>GST Total</span><span>{money(invoice?.gstTotal)}</span></div>
            <div className="flex-between" style={{ fontWeight: 800, fontSize: 16, borderTop: '2px solid #111', marginTop: 6, paddingTop: 6 }}>
              <span>Grand Total</span><span>{money(invoice?.total)}</span>
            </div>
            {invoice?.paymentMode && <div className="flex-between small mt-8"><span>Payment</span><span>{invoice.paymentMode.toUpperCase()}</span></div>}
            {invoice?.changeDue ? <div className="flex-between small"><span>Change</span><span>{money(invoice.changeDue)}</span></div> : null}
          </div>
        </div>

        <div className="flex mt-16" style={{ gap: 8 }}>
          <Button onClick={() => onPrintA4(invoice)}>🖨️ Print A4</Button>
          <Button variant="ghost" onClick={() => onPrintThermal(invoice)}>🧾 Thermal ({s.thermalWidth || '80mm'})</Button>
          <Button variant="success" onClick={onClose}>✓ Done</Button>
        </div>
      </div>
    </div>
  );
}
