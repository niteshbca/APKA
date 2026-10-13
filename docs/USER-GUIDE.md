# NiteshPro POS — Complete User Guide (Hindi + English)

Ye guide aapko **start se end tak** POS use karna sikhata hai — installation,
login, billing, email/WhatsApp, backup, mobile/desktop app aur troubleshooting.

---

## 1. Ye software kya hai?

NiteshPro POS ek complete retail billing system hai jo **online aur offline
dono** kaam karta hai:

- **Online** — data cloud (MongoDB) me turant save hota hai, saare devices par sync.
- **Offline / Office mode** — internet band ho jaye to bhi billing, printing,
  stock sab chalta rahega (data device me safe rehta hai) aur internet aane par
  apne aap sync ho jayega.

Ek hi code chalta hai: **Website**, **Mobile/Tablet PWA**, aur **Windows Desktop app**.

---

## 2. Pehli baar setup (developer / shop owner)

### 2.1 Requirements
- Node.js 18 ya upar
- MongoDB (local ya Atlas cloud)

### 2.2 Install
```bash
npm run install:all      # saari dependencies install
npm run setup            # license keys + admin accounts banata hai
```

### 2.3 Server config
`server/.env` file me database aur secret set karein:
```
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/pos_db?authSource=admin
JWT_SECRET=koi-lamba-random-secret
CLIENT_ORIGIN=http://localhost:5173
```

### 2.4 Chalana
```bash
npm run dev              # server (5000) + client (5173) dono
```
Browser me `http://localhost:5173` kholеin.

### 2.5 Default logins
| Username | Password   | Role       |
|----------|------------|------------|
| owner    | owner123   | superadmin |
| admin    | admin123   | admin      |
| cashier  | cashier123 | cashier    |

> Live jaane se pehle `admin`/`owner` ka password **zaroor badlein**.

---

## 3. Login page

- **Password login** — username + password.
- **PIN login** — cashier apne 4-digit PIN se fast login (PIN pad).
- Login page par saaf likha hai: **🌐 Online** + **🏢 Offline / Office Mode** —
  matlab dono support hai, internet na ho to bhi POS khulega.

---

## 4. License (billing ke liye zaroori)

Bina valid license billing nahi hoti (security feature).

License banane ke 3 tarike:
1. **CLI:**
   ```bash
   npm run license --prefix server -- --create "Customer Name" "Business Name" 2027-12-31 3
   ```
2. **License Admin** panel (owner login) → Create License.
3. API `POST /api/admin/license`.

Phir POS khulne par **Activation screen** par License ID daalein → device bind ho jayega.

---

## 5. Rozana ka kaam (Daily usage)

### 5.1 Naya bill (Billing)
1. **Sales & Billing** kholеin.
2. Product search / **barcode scan** (scanner digits + Enter).
3. Cart me qty, discount set karein.
4. **F9 / Pay** → payment mode (Cash / UPI / Card) chunein.
5. Invoice **print** (A4 ya 58mm/80mm thermal).

Shortcuts: `F2` search, `F9` pay, `F4` new bill.

### 5.2 Products / Customer
- **Products** me item add karein (SKU, barcode, price, GST, stock, image).
- **CRM — Customers** me customer add (mobile/email se invoice bhejne ke liye).

### 5.3 Inventory & Purchase
- **Purchases** se stock badhega.
- **Inventory** me stock history aur low-stock alert.

### 5.4 Dashboard & Reports
- **Dashboard** — aaj ki sale, profit, top products, 7-din trend, payment split.
- **Reports** — daily/monthly, product-wise, customer-wise, profit, stock.

---

## 6. Email / WhatsApp notification (invoice customer ko bhejna)

### 6.1 Billing screen se turant bhejna
Bill confirm hone par ek popup aata hai — **✉️ Email** / **💬 WhatsApp** par
click karein. Jo bhi email/phone diya hoga us par invoice chala jayega.

### 6.2 Settings kahan hain
**Notifications** page (ya **Branches → Edit → Sale Notifications**) par
per-branch email/WhatsApp config hoti hai.

### 6.3 Email provider — **“SMTP connect failed: ETIMEDOUT” ka fix** ⚠️
Ye error tab aata hai jab aapka network ya hosting (jaise Render free plan,
office firewall, ya kuch ISPs) **SMTP ports (465/587/25) block** kar dete hain.

**Sabse pakka solution:** SMTP ke bajaye **HTTPS Email API** use karein — ye
port 443 par chalti hai jo kabhi block nahi hota.

Notifications → Email → **Email Provider** me chunein:

| Provider   | Kahan se API key milegi                          |
|------------|--------------------------------------------------|
| **Resend** | resend.com → API Keys (recommended, free tier)   |
| **Brevo**  | brevo.com → SMTP & API → API Keys               |
| **SendGrid**| sendgrid.com → API Keys                         |
| **Mailgun**| mailgun.com → API Keys (+ sending domain)       |

Steps:
1. Provider = Resend (ya jo chahiye).
2. **API Key** paste karein.
3. **From Email** = verified sender (Resend/Brevo me domain verify karna hoga).
4. **Save** → **✉️ Send Test Email**.
5. Email aa gayi? Email notifications **Enable** kar dein.

> **SMTP hi use karna hai?** Host `smtp.gmail.com`, port 587, Gmail ke liye
> **16-character App Password** (Google Account → Security → App passwords).
> Normal Gmail password kaam nahi karega.

### 6.4 Connection check
Email card par **🩺 Check Connection** button hai — ye server se har SMTP port
test karta hai aur batata hai kaun-kaun se port khule hain:
- Green “open” = port reachable.
- Red “blocked” = port band hai → **HTTPS API provider** par switch karein.

### 6.5 WhatsApp
**WhatsApp** card me provider chunein: Meta Cloud API, UltraMsg, Twilio, ya
Generic HTTP API. Token / Phone Number ID / Sender number bharein → Test.

### 6.6 Delivery Log
Neeche **Delivery Log** me har email/WhatsApp ka status (sent/failed), reason
aur **Resend** button milta hai.

---

## 7. Backup — data safe rakhna (real-time)

**Backup & Restore** page par:

### 7.1 Automatic Backup (real-time scheduler)
- **Enable automatic backups** checkbox ON.
- **Every (hours)** — kitne ghante me snapshot (default 6).
- **Keep last N backups** — purane kitne rakhne hain (default 14).
- **Save Auto-backup** → server background me khud backup leta rahega.
- **⚡ Back up now** se turant snapshot.

### 7.2 Manual backup
- **💾 Create Backup** — poore company data ka JSON snapshot.
- **Download** — file apne paas safe rakhein.
- **Restore** — backup wapas load (current data replace hoga).
- **Del** — purani file delete.

> Backups server par `server/backups/` folder me save hote hain.

---

## 8. Online / Offline sync

Sidebar me status badge dikhta hai:
- `● ONLINE`
- `● OFFLINE`
- `⟳ SYNCING`
- `✓ SYNC COMPLETED`
- `✕ SYNC FAILED` (+ pending count)

Offline me bill banayein → internet aane par apne aap sync (koi duplicate nahi,
invoice number server se unique milta hai).

---

## 9. Mobile, Tablet aur Desktop app

### 9.1 Mobile / Tablet (PWA)
```bash
npm run build --prefix client
npm run server
```
- Phone/tablet browser me `http://<server-ip>:5000` kholеin.
- **Android (Chrome):** “Install app” prompt → tap.
- **iOS (Safari):** Share → *Add to Home Screen*.

### 9.2 Windows Desktop (.exe)
```bash
npm run desktop:dist     # installer banata hai
npm run desktop          # development mode
```

### 9.3 Downloads page
Login page par **💻 Desktop App · 📱 Mobile App** link se installer milta hai.

---

## 10. Troubleshooting (common problems)

| Problem | Solution |
|---------|----------|
| **Email nahi ja rahi / SMTP connect failed: ETIMEDOUT** | Email Provider = **Resend/Brevo/SendGrid** (HTTPS API) chunein. Ya SMTP me port/host sahi karein aur **🩺 Check Connection** chalayein. |
| Gmail “Username and Password not accepted” | Normal password nahi — **App Password** (16 chars) use karein. |
| Email “from” reject | From Email verified hona chahiye (Resend/Brevo me domain verify). |
| `bad auth` MongoDB | `authSource=admin` add karein. |
| `querySrv ECONNREFUSED` | `.env` me direct shard-list `mongodb://...` form use karein. |
| Billing blocked | License expire ho gayi → renew karein (License Admin). |
| Data sync nahi ho raha | Internet check karein; sidebar badge dekhein; sync worker env (`CLOUD_SYNC_*`) set ho. |
| Site slow/blank on mobile | Browser cache clear, app dobara install karein. |

---

## 11. Security tips (live jaane se pehle)

- `JWT_SECRET` ko lamba random rakhein.
- `owner`/`admin` ke default passwords badlein.
- `server/keys/private.pem` kabhi share na karein.
- HTTPS par deploy karein (Render/VPS) — PWA install aur API providers ke liye zaroori.

---

## 12. Quick reference — commands

```bash
npm run install:all        # install
npm run setup              # keys + admin
npm run dev                # dev (server + client)
npm run server             # sirf backend
npm run seed:data --prefix server   # demo data (branches, products, sales)
npm run license --prefix server -- --list
npm run build --prefix client   # production build
npm run desktop:dist       # Windows installer
```

---

Kisi bhi step par doubt ho to support: **📞 8810751872**.
