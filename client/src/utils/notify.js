export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  digits = digits.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) digits = '91' + digits;
  return digits;
}

export function waLink(phone, text) {
  const n = normalizePhone(phone);
  if (!n) return '';
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function mailtoLink(email, subject, body) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function saleMessage(invoice, businessName = '') {
  const items = (invoice.items || [])
    .map((it, i) => {
      const total = it.total != null ? Number(it.total) : Number(it.qty) * Number(it.price);
      return `${i + 1}. ${it.name} x${it.qty} = ₹${total.toFixed(2)}`;
    })
    .join('\n');
  const date = invoice.createdAt ? new Date(invoice.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
  return [
    `Hello ${invoice.customerName || 'Customer'}!`,
    `Thank you for shopping at ${businessName || 'Our Store'}.`,
    '',
    `Invoice: ${invoice.invoiceNo}`,
    `Date: ${date}`,
    `Amount: ₹${Number(invoice.total).toFixed(2)}`,
    `Payment: ${(invoice.paymentMode || '').toUpperCase()}`,
    items ? `\n${items}` : '',
    '\nSee you soon!',
  ].filter((l) => l !== '').join('\n');
}

export function saleEmailSubject(invoice, businessName = '') {
  return `Your Invoice ${invoice.invoiceNo} from ${businessName || 'Our Store'}`;
}
