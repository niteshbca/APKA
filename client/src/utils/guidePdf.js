import { jsPDF } from 'jspdf';

/**
 * Generates a complete, professional "how to use the software from the start"
 * user guide and downloads it as a PDF. Used by the Settings screen.
 *
 * Content covers: introduction, login, license activation, dashboard, billing,
 * products, customers, purchase, inventory, reports, notifications, backup,
 * online/offline sync, mobile & desktop apps, settings, users/branches,
 * troubleshooting, security and support.
 */
const CONTENT = [
  { t: 'h1', x: 'Introduction' },
  { t: 'sub', x: 'Aapka apna smart retail billing software. Ye guide shuru se lekar daily kaam tak, step-by-step sab kuch sikhata hai.' },

  { t: 'h2', x: '1. Ye software kya hai?' },
  { t: 'p', x: 'NiteshPro POS ek complete retail billing system hai jo online aur offline dono tarah se kaam karta hai.' },
  { t: 'ul', items: [
    'Online — data cloud (MongoDB) me turant save hota hai aur saare devices par sync hota hai.',
    'Offline / Office mode — internet band hone par bhi billing, printing aur stock chalta rehta hai; internet aate hi apne aap sync ho jata hai.',
    'Ek hi software Website, Mobile/Tablet (PWA) aur Windows Desktop app par chalta hai.',
  ] },

  { t: 'h2', x: '2. Shuruaat (Getting Started)' },
  { t: 'h3', x: '2.1 Login kaise karein' },
  { t: 'ol', items: [
    'Apni POS website ka URL browser me kholein (jaise https://apka-pos.com).',
    'Apna username aur password daalein, ya cashier ke liye 4-digit PIN use karein.',
    'Login karne par aapka dashboard khul jayega.',
  ] },
  { t: 'h3', x: '2.2 Pehli baar login par kya karein' },
  { t: 'ol', items: [
    'Default password turant badlein (Settings → Users par apna password change karein).',
    'Settings me Business Name, Address, Phone, GSTIN aur logo bharein — ye invoice par chhapega.',
    'Products aur Categories add karein taaki billing shuru kar saken.',
  ] },

  { t: 'h2', x: '3. License activation' },
  { t: 'p', x: 'Billing ke liye valid license zaroori hai (security feature). Invoice banane se pehle license activate karein.' },
  { t: 'ol', items: [
    'Apne admin/vendor se License ID lein.',
    'POS khulne par Activation screen aayegi — wahan License ID daalein.',
    'Activate hone par aapka device us license se bind ho jayega aur billing chalu ho jayegi.',
  ] },

  { t: 'h2', x: '4. Dashboard (ek nazar me sab)' },
  { t: 'ul', items: [
    'Aaj ki total sale, profit aur orders.',
    'Top selling products aur 7-din ka sale trend (chart).',
    'Payment split — Cash, UPI aur Card ka hissa.',
    'Recent bills par click karke turant invoice dekh sakte hain.',
  ] },

  { t: 'h2', x: '5. Naya bill banana (Sales & Billing)' },
  { t: 'ol', items: [
    'Sidebar me Sales & Billing kholen.',
    'Product ko search karein ya barcode scanner se scan karein (scanner digits + Enter).',
    'Cart me quantity aur discount set karein.',
    'Customer chunein (optional) — naam, mobile/email daalein taaki bill bhej saken.',
    'Pay (F9) dabayen aur payment mode (Cash / UPI / Card) chunein.',
    'Invoice print karein — A4 ya 58mm/80mm thermal printer.',
  ] },
  { t: 'p', x: 'Keyboard shortcuts: F2 = search, F9 = pay, F4 = naya bill.' },

  { t: 'h2', x: '6. Products & Categories' },
  { t: 'ul', items: [
    'Products me item add karein: SKU, barcode, price, GST, stock aur image.',
    'Categories se products ko group karein — billing screen par tabs ban jayenge.',
    'Low-stock item highlight hoga taaki samay par order kar saken.',
  ] },

  { t: 'h2', x: '7. Customers (CRM)' },
  { t: 'ul', items: [
    'Customers me naya customer add karein (mobile aur email ke saath).',
    'Bill banate waqt customer chunein — invoice uske email/WhatsApp par bhej sakte hain.',
    'Customer-wise khareedari history report me dekhein.',
  ] },

  { t: 'h2', x: '8. Purchase & Inventory' },
  { t: 'ul', items: [
    'Purchases se supplier ka maal add karein — stock apne aap badh jayega.',
    'Inventory me stock history, adjustment aur low-stock alert milega.',
    'Stock ki value aur reorder level set kar sakte hain.',
  ] },

  { t: 'h2', x: '9. Reports (business samajhne ke liye)' },
  { t: 'ul', items: [
    'Daily aur monthly sale report.',
    'Product-wise aur customer-wise sale aur profit.',
    'GST report aur payment-mode wise collection.',
    'Stock report aur low-stock list.',
  ] },

  { t: 'h2', x: '10. Invoice customer ko bhejna (Email / WhatsApp)' },
  { t: 'ol', items: [
    'Bill confirm hone par ek popup aata hai — Email ya WhatsApp par click karein.',
    'Jo email/phone diya hoga, us par invoice chala jayega.',
    'Notifications page par provider set karein: Email ke liye SMTP ya HTTPS API (Resend, Brevo, SendGrid), WhatsApp ke liye Meta Cloud API / UltraMsg / Twilio.',
    'Naam ke saamne Check Connection se pata chale kaun se SMTP port khule hain.',
  ] },

  { t: 'h2', x: '11. Backup & Restore (data safe rakhein)' },
  { t: 'ul', items: [
    'Automatic backup ON karein — kitne-ghante me snapshot (default 6) aur kitne backups rakhne hain.',
    'Back up now se turant snapshot lein.',
    'Create Backup se poore company data ka JSON download karein.',
    'Restore se backup wapas load karein (dhyan: current data replace hoga).',
  ] },

  { t: 'h2', x: '12. Online / Offline sync' },
  { t: 'ul', items: [
    'Sidebar me status dikhta hai: ONLINE, OFFLINE, SYNCING, SYNC COMPLETED, SYNC FAILED.',
    'Offline me bill banayein — internet aate hi data apne aap sync ho jayega.',
    'Koi duplicate nahi hota; invoice number server se unique milta hai.',
  ] },

  { t: 'h2', x: '13. Mobile / Tablet aur Windows Desktop app' },
  { t: 'h3', x: '13.1 Mobile / Tablet (PWA)' },
  { t: 'ul', items: [
    'Phone/tablet browser me apna POS kholen.',
    'Android (Chrome): "Install app" prompt par tap karein.',
    'iOS (Safari): Share → Add to Home Screen.',
  ] },
  { t: 'h3', x: '13.2 Windows Desktop (.exe)' },
  { t: 'ul', items: [
    'Downloads page se Windows installer download karein.',
    'Install karke normal app ki tarah kholein — offline bhi chalti hai.',
  ] },

  { t: 'h2', x: '14. Settings' },
  { t: 'ul', items: [
    'Appearance — apni brand colour chunein; poore software (buttons, sidebar, charts) par turant lag jayegi.',
    'Business Details — naam, address, phone, GSTIN, logo.',
    'Invoice & Printing — thermal width (58mm/80mm), invoice prefix, currency, footer note.',
    'Users & Roles — staff add karein aur unke permissions set karein.',
    'Branches — ek se zyada shop/branch chala sakte hain, har branch ka alag stock aur sale.',
  ] },

  { t: 'h2', x: '15. Troubleshooting (common problems)' },
  { t: 'ul', items: [
    'Email nahi ja rahi / SMTP connect failed: ETIMEDOUT → SMTP ke bajaye HTTPS API provider (Resend/Brevo/SendGrid) chunein.',
    'Gmail "Username and Password not accepted" → normal password nahi, 16-char App Password use karein.',
    'MongoDB "bad auth" → connection string me authSource=admin add karein.',
    'Billing blocked → license expire ho gayi; renew karein.',
    'Data sync nahi ho raha → internet check karein aur sidebar ka sync badge dekhein.',
    'Site blank/slow on mobile → browser cache clear karke app dobara install karein.',
  ] },

  { t: 'h2', x: '16. Security tips (live jaane se pehle)' },
  { t: 'ul', items: [
    'Owner/Admin ke default passwords turant badlein.',
    'JWT secret lamba aur random rakhein.',
    'Private keys kabhi kisi ke saath share na karein.',
    'HTTPS par deploy karein (PWA install aur API providers ke liye zaroori).',
  ] },

  { t: 'h2', x: '17. Support' },
  { t: 'p', x: 'Kisi bhi step par doubt ho to support se sampark karein: 8810751872.' },
  { t: 'p', x: 'NiteshPro POS — aapke business ka smart saathi.' },
];

export function generateGuidePdf(settings = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  const business = settings.businessName || 'NiteshPro POS';

  let y = 0;
  let page = 1;

  const goPage = () => {
    doc.addPage();
    page += 1;
    y = margin;
  };
  const ensure = (needed) => {
    if (y + needed > pageH - 54) goPage();
  };

  const header = () => {
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 130, 150);
    doc.text(business, margin, 26);
    doc.text('User Guide', pageW - margin, 26, { align: 'right' });
    doc.setDrawColor(230, 232, 238);
    doc.line(margin, 32, pageW - margin, 32);
  };

  const footer = () => {
    doc.setDrawColor(230, 232, 238);
    doc.line(margin, pageH - 40, pageW - margin, pageH - 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(150, 155, 165);
    doc.text('Powered by NiteshPro POS', margin, pageH - 24);
    doc.text(`Page ${page}`, pageW - margin, pageH - 24, { align: 'right' });
  };

  // Cover title block
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 210, 'F');
  doc.setFillColor(124, 58, 237);
  doc.circle(pageW - 40, 40, 120, 'F');
  doc.setFillColor(34, 211, 238);
  doc.circle(pageW - 190, 190, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text('NiteshPro POS', margin, 88);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Complete User Guide', margin, 116);
  doc.setFontSize(11);
  doc.text('Shuru se lekar daily kaam tak — step by step', margin, 140);
  doc.setFontSize(10);
  if (settings.businessName) doc.text(settings.businessName, margin, 172);
  y = 250;

  doc.setTextColor(40, 48, 66);

  for (const block of CONTENT) {
    if (block.t === 'h1') {
      ensure(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(24, 30, 48);
      doc.text(block.x, margin, y);
      y += 10;
      doc.setDrawColor(79, 70, 229);
      doc.setLineWidth(2);
      doc.line(margin, y, margin + 70, y);
      doc.setLineWidth(1);
      y += 22;
    } else if (block.t === 'sub') {
      const lines = doc.splitTextToSize(block.x, maxW);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(90, 100, 120);
      lines.forEach((l) => { ensure(18); doc.text(l, margin, y); y += 16; });
      y += 8;
    } else if (block.t === 'h2') {
      ensure(34);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(60, 52, 200);
      const lines = doc.splitTextToSize(block.x, maxW);
      lines.forEach((l) => { ensure(20); doc.text(l, margin, y); y += 19; });
      y += 4;
    } else if (block.t === 'h3') {
      ensure(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(40, 48, 66);
      doc.text(block.x, margin, y);
      y += 17;
    } else if (block.t === 'p') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(55, 62, 80);
      const lines = doc.splitTextToSize(block.x, maxW);
      lines.forEach((l) => { ensure(16); doc.text(l, margin, y); y += 15; });
      y += 5;
    } else if (block.t === 'ul' || block.t === 'ol') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(55, 62, 80);
      block.items.forEach((it, i) => {
        const bullet = block.t === 'ol' ? `${i + 1}.` : '•';
        const ind = margin + 16;
        const lines = doc.splitTextToSize(it, maxW - 18);
        lines.forEach((l, li) => {
          ensure(15);
          if (li === 0) {
            doc.setTextColor(79, 70, 229);
            doc.setFont('helvetica', 'bold');
            doc.text(bullet, margin + 2, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(55, 62, 80);
          }
          doc.text(l, ind, y);
          y += 15;
        });
        y += 3;
      });
      y += 4;
    }
  }

  // Stamp header/footer on every page
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    if (p > 1) header();
    footer();
  }

  const safe = String(settings.businessName || 'NiteshPro-POS').replace(/[^\w\-]+/g, '-');
  doc.save(`${safe}-User-Guide.pdf`);
}
