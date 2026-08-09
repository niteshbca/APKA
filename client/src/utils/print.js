import { money } from './format';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildA4(settings, invoice) {
  const items = (invoice.items || [])
    .map(
      (it) => `
      <tr>
        <td>${esc(it.name)}</td>
        <td style="text-align:center">${Number(it.qty) || 0}</td>
        <td style="text-align:right">${money(it.price)}</td>
        <td style="text-align:right">${it.gstRate || 0}%</td>
        <td style="text-align:right">${money(it.lineDiscount || 0)}</td>
        <td style="text-align:right">${money(it.total)}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; padding: 24px; }
    .inv { max-width: 720px; margin: 0 auto; border: 1px solid #ddd; padding: 28px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 14px; }
    .biz { font-size: 24px; font-weight: 800; }
    .meta { font-size: 12px; color: #444; margin-top: 4px; }
    h2 { font-size: 16px; letter-spacing: 2px; text-transform: uppercase; }
    .parties { display: flex; justify-content: space-between; margin: 16px 0; font-size: 13px; }
    .parties .box { width: 48%; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
    th { background: #f3f4f6; text-align: left; padding: 8px; border-bottom: 1px solid #999; }
    td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; }
    .totals { width: 300px; margin-left: auto; margin-top: 14px; font-size: 13px; }
    .totals tr td { border: none; padding: 4px 8px; }
    .totals .grand td { font-weight: 800; font-size: 16px; border-top: 2px solid #111; }
    .foot { margin-top: 30px; text-align: center; font-size: 12px; color: #555; }
  </style></head><body>
  <div class="inv">
    <div class="head">
      <div>
        <div class="biz">${esc(settings.businessName || 'Business')}</div>
        <div class="meta">${esc(settings.address || '')}</div>
        <div class="meta">Phone: ${esc(settings.phone || '')} | GSTIN: ${esc(settings.gstin || '')}</div>
      </div>
      <div style="text-align:right">
        <h2>Tax Invoice</h2>
        <div class="meta">Invoice No: <b>${esc(invoice.invoiceNo)}</b></div>
        <div class="meta">Date: ${esc(new Date(invoice.createdAt).toLocaleString())}</div>
        <div class="meta">Payment: ${esc(invoice.paymentMode || '')}</div>
      </div>
    </div>
    <div class="parties">
      <div class="box"><b>Billed To</b><br>${esc(invoice.customerName || 'Walk-in Customer')}<br>${esc(invoice.customerMobile || '')}<br>${esc(invoice.customerAddress || '')}</div>
      <div class="box" style="text-align:right"><b>GSTIN</b><br>${esc(invoice.customerGst || '-')}</div>
    </div>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>GST</th><th>Disc</th><th>Amount</th></tr></thead>
      <tbody>${items}</tbody>
    </table>
    <table class="totals">
      <tr><td>Subtotal</td><td style="text-align:right">${money(invoice.subtotal)}</td></tr>
      ${invoice.discount ? `<tr><td>Discount</td><td style="text-align:right">-${money(invoice.discount)}</td></tr>` : ''}
      ${invoice.taxable !== undefined ? `<tr><td>Taxable</td><td style="text-align:right">${money(invoice.taxable)}</td></tr>` : ''}
      <tr><td>GST Total</td><td style="text-align:right">${money(invoice.gstTotal)}</td></tr>
      <tr class="grand"><td>Grand Total</td><td style="text-align:right">${money(invoice.total)}</td></tr>
      ${invoice.amountReceived ? `<tr><td>Paid (${esc(invoice.paymentMode || '')})</td><td style="text-align:right">${money(invoice.amountReceived)}</td></tr>` : ''}
      ${invoice.changeDue ? `<tr><td>Change</td><td style="text-align:right">${money(invoice.changeDue)}</td></tr>` : ''}
    </table>
    <div class="foot">${esc(settings.footerNote || 'Thank you for your purchase!')}</div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
  </body></html>`;
}

function buildThermal(settings, invoice) {
  const width = settings.thermalWidth === '58mm' ? '58mm' : '80mm';
  const items = (invoice.items || [])
    .map(
      (it) =>
        `<tr>
          <td>${esc(it.name)}${it.gstRate ? `<br><span class="g">@${it.gstRate}% GST</span>` : ''}</td>
          <td>${Number(it.qty) || 0} x ${money(it.price)}</td>
          <td>${money(it.total)}</td>
        </tr>`
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
    @page { size: ${width}; margin: 4mm; }
    body { font-family: monospace; font-size: 12px; width: 100%; margin: 0; color: #000; }
    .th { text-align: center; }
    .biz { font-size: 15px; font-weight: 700; }
    .line { border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; vertical-align: top; }
    .tt { display: flex; justify-content: space-between; font-weight: 700; }
    .g { color: #444; font-size: 10px; }
    .center { text-align: center; }
  </style></head><body>
  <div class="th">
    <div class="biz">${esc(settings.businessName || 'Business')}</div>
    <div>${esc(settings.address || '')}</div>
    <div>Ph: ${esc(settings.phone || '')} | GSTIN: ${esc(settings.gstin || '')}</div>
  </div>
  <div class="line"></div>
  <div>Invoice: <b>${esc(invoice.invoiceNo)}</b></div>
  <div>Date: ${esc(new Date(invoice.createdAt).toLocaleString())}</div>
  <div>Customer: ${esc(invoice.customerName || 'Walk-in')}</div>
  <div>Payment: ${esc(invoice.paymentMode || '')}</div>
  <div class="line"></div>
  <table>${items}</table>
  <div class="line"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${money(invoice.subtotal)}</td></tr>
    ${invoice.discount ? `<tr><td>Discount</td><td style="text-align:right">-${money(invoice.discount)}</td></tr>` : ''}
    ${invoice.taxable !== undefined ? `<tr><td>Taxable</td><td style="text-align:right">${money(invoice.taxable)}</td></tr>` : ''}
    <tr><td>GST</td><td style="text-align:right">${money(invoice.gstTotal)}</td></tr>
  </table>
  <div class="tt" style="font-size:14px;margin-top:4px"><span>GRAND TOTAL</span><span>${money(invoice.total)}</span></div>
  ${invoice.changeDue ? `<div class="tt"><span>Change</span><span>${money(invoice.changeDue)}</span></div>` : ''}
  <div class="line"></div>
  <div class="center">${esc(settings.footerNote || 'Thank you!')}</div>
  <div class="center">Powerered by POS Billing Suite</div>
  <script>window.onload = function(){ window.print(); }</script>
  </body></html>`;
}

export function printInvoice(settings, invoice, type = 'A4') {
  const html = type === 'thermal' ? buildThermal(settings, invoice) : buildA4(settings, invoice);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Please allow popups to print invoices.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  return win;
}
