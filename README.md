# POS Billing Suite — Professional Point of Sale (MERN)

A complete, production-ready **POS Billing Software** built with the **MERN stack** (MongoDB, Express, React, Node.js) that works **both ONLINE and OFFLINE** with automatic synchronization, JWT authentication, invoice printing (A4 + thermal), a secure **signed-license** system with device binding and anti-bypass protection, and **PWA / mobile / desktop / website** support from a single codebase.

---

## Tech Stack

| Layer      | Technology                                            |
| ---------- | ----------------------------------------------------- |
| Frontend   | React 18 + Vite + React Router + Axios                |
| Backend    | Node.js + Express.js                                  |
| Database   | MongoDB Atlas (Mongoose)                              |
| Offline DB | IndexedDB (custom promise wrapper, no extra deps)     |
| PWA        | Web App Manifest + Service Worker (installable, offline) |
| Auth       | JWT + role-based access (superadmin / admin / cashier)|
| License    | RSA-2048 signed licenses, WebCrypto verification      |
| Barcode    | Keyboard-emulation scanner support                    |
| Printing   | A4 and 58mm/80mm thermal invoices                     |
| Desktop    | Electron (Windows EXE)                                |

> **Online = MongoDB Atlas, Offline = IndexedDB.** Data is stored in **both** places with no conflicts: every operation carries a unique `clientOpId` / `clientSaleId`, so syncing is idempotent and never creates duplicates. One codebase runs as a **website**, an installable **PWA (mobile/tablet)**, and a **Windows desktop app**.

---

## Project Structure

```
pos/
├── package.json              # root scripts (concurrently)
├── server/                   # Express backend
│   ├── .env                  # environment variables
│   ├── keys/                 # RSA key pair (generated on setup — DO NOT COMMIT)
│   ├── scripts/
│   │   ├── setup.js          # keys + seed admin
│   │   ├── generateKeys.js   # RSA key pair + copies public key to client
│   │   ├── seedAdmin.js      # owner/admin/cashier demo accounts
│   │   └── licenseAdmin.js   # CLI license management
│   └── src/
│       ├── server.js
│       ├── config/db.js
│       ├── middleware/       # auth.js, license.js (server-side enforcement), errorHandler.js
│       ├── models/           # 13 models: User, Product, Category, Customer, Sale,
│       │                     #   Invoice, Purchase, StockTransaction, License, Device,
│       │                     #   SyncQueue, Counter, Setting
│       ├── routes/           # auth, users, products, categories, customers, sales,
│       │                     #   invoices, purchases, stock, dashboard, reports,
│       │                     #   license, adminLicense, devices, sync, settings
│       └── services/         # keyService, licenseService, invoiceService,
│                             #   stockService, syncService, statsService
└── client/                   # React frontend
    └── src/
        ├── api/axios.js          # axios instance + JWT interceptor
        ├── context/              # Auth, Sync, Toast contexts
        ├── db/                   # IndexedDB wrapper + offlineService (offline-first)
        ├── sync/engine.js        # ONLINE/OFFLINE/SYNCING/SYNC COMPLETED/SYNC FAILED
        ├── utils/                # gst, print, barcode, crypto, license (signed verification)
        ├── components/           # Layout, LicenseGate, ui kit, Billing widgets
        └── pages/                # Dashboard, Billing, Products, Categories, Customers,
                                  # Purchases, Inventory, Invoices, Reports, Users,
                                  # License, LicenseAdmin, Settings, Login, Activation, Expired
```

---

## 1. Installation

Prerequisites: **Node.js 18+**, **npm**, and a **MongoDB Atlas** cluster (online database).

```bash
# 1) Install all dependencies (root + server + client)
npm run install:all

# 2) Setup: generate RSA license keys + seed admin users
npm run setup

# 3) Configure server/.env with your MongoDB Atlas URI (see below)
```

### MongoDB Atlas configuration

The online database is **MongoDB Atlas**. Edit `server/.env`:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/pos_db?authSource=admin&retryWrites=true&w=majority
```

Two important notes:

- **`authSource=admin` is required** — Atlas database users authenticate against the `admin` auth DB. Without it you'll get `bad auth`.
- If your machine's Node DNS resolver fails with `querySrv ECONNREFUSED` (Windows DNS works but c-ares doesn't), use the **direct shard list** form instead — it's already configured in `.env`:

```
MONGODB_URI=mongodb://<user>:<password>@ac-iekqld9-shard-00-00.bqmxco3.mongodb.net:27017,ac-iekqld9-shard-00-01.bqmxco3.mongodb.net:27017,ac-iekqld9-shard-00-02.bqmxco3.mongodb.net:27017/pos_db?ssl=true&retryWrites=true&w=majority&authSource=admin
```

`npm run setup`:
- Generates the RSA-2048 key pair into `server/keys/`.
- Copies the **public key** into `client/src/utils/licensePublicKey.js` so the browser can verify licenses **fully offline**.
- Seeds users: `owner/owner123` (superadmin), `admin/admin123` (admin), `cashier/cashier123` (cashier).

---

## 2. How to Run

```bash
# Start BOTH backend (http://localhost:5000) and frontend (http://localhost:5173)
npm run dev

# Or separately:
npm run server     # Express API on port 5000
npm run client     # Vite dev server on port 5173 (proxies /api to 5000)
```

Open **http://localhost:5173** and log in as `admin` / `admin123`.

---

## 3. Demo / Test Login Accounts

| Username | Password    | Role       |
| -------- | ----------- | ---------- |
| `owner`  | `owner123`  | superadmin |
| `admin`  | `admin123`  | admin      |
| `cashier`| `cashier123`| cashier    |

---

## 4. License Management (important first step)

The POS **refuses to bill without a valid license** (enforced both client-side with signature verification and server-side on every sale/sync request).

### Create a license (3 ways)

**A. CLI (recommended for testing):**
```bash
# Create: --create "Customer" "Business" YYYY-MM-DD [maxDevices]
npm run license --prefix server -- --create "Demo Store Owner" "Demo Super Store" 2027-12-31 3

# List
npm run license --prefix server -- --list
```

**B. License Admin panel:** log in as `owner`, go to **License Admin** → *Create License* → copy the generated License ID (format `NP-4587-ABCD`).

**C. Direct API** (POST `/api/admin/license` with the superadmin token).

> Current demo database has one active license: `NP-3374-PLHT` (expires 2027-12-31, max 3 devices). You can use it, or create a fresh one with the CLI.

### Activate the POS
1. Open the POS in a browser. It shows the **Activation screen**.
2. Enter the License ID, e.g. `NP-7044-ET4T`.
3. The device gets **bound** to the license (max devices enforced) and the **signed** license is stored locally.
4. From now on the app verifies the **RSA signature + expiry offline**.

### Create and test an EXPIRED license
```bash
npm run license --prefix server -- --expired "Old Business" "Expired Shop"
```
Then activate that License ID in a fresh browser (or after clearing IndexedDB). The app will show:

> **Your software license has expired. Please renew your license.**

and billing will be blocked. Renew it from the License Admin panel (or CLI `--renew`) and re-validate on the POS.

---

## 5. How the License Security Works (anti-bypass)

1. **Signed license** — the license payload `{licenseId, customerName, businessName, startDate, expiryDate, status, maxDevices, issuedAt}` is RSA-SHA256 signed by the server's private key. The POS verifies it with the embedded **public key** using WebCrypto — editing the expiry date or status breaks the signature.
2. **Server-side enforcement** — every sale, purchase and sync API call is guarded by `licenseGuard` (backend/local-architecture protection, not just frontend JS). If no active license exists, the server returns `403 LICENSE_EXPIRED`.
3. **Device binding** — activation binds a unique device ID to the license, up to `maxDevices`.
4. **Periodic online validation** — while online the POS re-validates and stores the server clock offset to detect **system-date tampering** (the effective expiry is computed from server-adjusted time).
5. **Last-validation state** — saved locally; the app refuses to run with an expired signed license even offline.

---

## 6. How the Online / Offline System Works

### Architecture

```
        POS Application (website / PWA / desktop)
                        │
           ┌────────────┴────────────┐
      ONLINE│                       │OFFLINE
           ▼                        ▼
   MongoDB Atlas            IndexedDB (local)
        (cloud)              (browser/device)
           └────────┬────────────┘
                    │
             Sync Engine
                    │
          Internet वापस आते ही
                    ▼
             MongoDB Atlas (idempotent)
```

- **Online:** every write goes to MongoDB Atlas immediately.
- **Offline:** writes go to IndexedDB and are queued in the local **outbox**.
- **Reconnect:** the sync engine pushes the outbox, pulls master data, and updates the status badge.
- **No conflicts:** each operation carries a unique `clientOpId` and `clientSaleId` with a MongoDB **unique index**, so the same batch can never be inserted twice (idempotent). If two devices sell the same product offline, each sale is its own record; invoice numbers stay unique (server renumbers `LOC-…` → `INV-YYYYMMDD-NNNN`).

### Offline billing (no internet)
- Products/customers/settings are cached in **IndexedDB**.
- The Billing screen keeps working: search, barcode scan, cart, GST, discount, payment modes, invoice generation and **printing** all work offline.
- Each sale is written to IndexedDB (`sales`, `invoices`) and stock is **deducted locally**.
- Every offline operation is queued in the **outbox** (`syncQueue` client side) with a unique `clientSaleId`.

### When internet returns
The sync engine automatically:
1. **Pushes** queued operations to `POST /api/sync/push`.
2. The server creates the sales/invoices/stock-transactions **idempotently** (`clientSaleId` unique index → re-pushing the same batch returns `duplicate`, never a second invoice).
3. Local `LOC-…` invoice numbers are replaced with real server numbers (`INV-YYYYMMDD-0001`).
4. **Pulls** master data (products, categories, customers, licenses) changed on the server.
5. Status shows **SYNCING → SYNC COMPLETED**, or **SYNC FAILED** / **OFFLINE**.

Statuses shown in the sidebar: `● ONLINE`, `● OFFLINE`, `⟳ SYNCING`, `✓ SYNC COMPLETED`, `✕ SYNC FAILED` (+ pending count).

---

## 7. Features

- **Auth**: login, JWT, role-based access control.
- **Products**: add/edit/delete, SKU, barcode, category, purchase/selling price, GST, stock, min-stock alert, search, barcode search.
- **Billing**: fast keyboard-driven screen (`F2` search, `F9` pay, `F4` new bill), barcode scanner support, cart with qty +/- / remove / per-line discount, GST buckets, order discount, customer selection, cash/UPI/card payment, invoice preview + print (A4 & thermal).
- **Inventory**: auto stock reduction on sale, purchase entry, stock adjustment, stock history, low-stock alerts.
- **Customers**: name/mobile/address/GST, purchase history.
- **Invoices**: unique invoice number, business details, customer details, line items, totals, payment mode, date/time, printable.
- **Dashboard**: today's sales, invoices, profit, products, low stock, cash/UPI/card collection.
- **Reports**: daily & monthly sales, product-wise, customer-wise, payment-wise, profit, stock, date-range filter.
- **License Admin panel** (superadmin): create/renew/suspend/activate licenses, set max devices, view customers & bound devices, block devices.

---

## 8. How to Test Each Mode

### Online mode
1. Run `npm run dev` with MongoDB running.
2. Log in, activate a license, add products, create a bill, pay.
3. The sale appears in the Dashboard, Invoices and Reports immediately.

### Offline mode
1. Open the POS once while online so products are cached, then **turn off the internet / stop the server**.
2. The sidebar shows `● OFFLINE`. Billing still works — create bills, print invoices.
3. Sales are stored in IndexedDB; stock decreases locally.

### Synchronization
1. Create bills offline (several).
2. Restore internet. Watch the sidebar: `● OFFLINE → SYNCING → ✓ SYNC COMPLETED`.
3. Log into the **License Admin** or check Invoices in another browser — the offline sales now appear with proper `INV-…` numbers.
4. Push the same batch twice (or refresh during sync) — no duplicate invoices (idempotent).

---

## 9. API Overview

| Method | Endpoint                    | Description                                    |
| ------ | --------------------------- | ---------------------------------------------- |
| POST   | `/api/auth/login`           | Login → JWT                                    |
| GET    | `/api/dashboard`            | Today + totals dashboard                       |
| CRUD   | `/api/products`             | Product management (search/barcode/category)   |
| CRUD   | `/api/categories`           | Category management                            |
| CRUD   | `/api/customers`            | Customers + `/history`                         |
| POST   | `/api/sales`                | Create sale (online) — stock + invoice auto    |
| GET    | `/api/invoices`             | Invoice history                                |
| CRUD   | `/api/purchases`            | Purchase entries (adds stock)                  |
| POST   | `/api/stock/adjust`         | Manual stock adjustment                        |
| GET    | `/api/stock/transactions`   | Stock history                                  |
| GET    | `/api/reports/*`            | sales, product-wise, customer-wise, payment-wise, profit, stock |
| POST   | `/api/license/activate`     | Activate + bind device                         |
| POST   | `/api/license/validate`     | Online validation (returns server time)        |
| GET    | `/api/license/public-key`   | Public key (for verification)                  |
| CRUD   | `/api/admin/license`        | Superadmin license management + devices        |
| POST   | `/api/sync/push`            | Push offline operations (idempotent)           |
| GET    | `/api/sync/pull`            | Pull changed master data                       |
| CRUD   | `/api/users`                | User management                                |
| GET/PUT| `/api/settings`             | Business settings (invoice header/printing)    |

---

## 10. PWA / Mobile Install (Android + iOS)

The same React build is a fully installable **PWA** — it runs in any browser and can be installed to the home screen like a native app (works offline too).

```bash
npm run build --prefix client   # outputs client/dist (PWA-ready)
npm run server                  # Express serves the PWA on http://<host>:5000
```

- Open `http://<host>:5000` on the phone/tablet.
- **Android (Chrome):** the browser shows an **"Install app / Add to Home Screen"** prompt (needs HTTPS or `localhost`). Tap it → the POS opens full-screen, offline-capable.
- **iOS (Safari):** Share → *Add to Home Screen* → open the icon.
- The Service Worker (`sw.js`) caches the app shell, and IndexedDB stores all data, so billing keeps working without internet.

> For installing on other phones over the network, deploy the Express server to a host with HTTPS (e.g. a VPS/Render/Atlas-adjacent service) and set `CLIENT_ORIGIN` + Atlas in `server/.env`. All other devices then open the same URL.

---

## 11. Windows Desktop App (EXE)

The POS can be packaged as a **Windows desktop application** (`.exe` installer) using **Electron**. The app bundles the Express server + built React app, so a double-click opens the POS in its own window (no browser needed).

**Prerequisite:** an internet connection for the first run (MongoDB Atlas is the database — no local MongoDB installation required).

```bash
# Build the Windows installer (outputs desktop/dist/POS Billing Suite Setup 1.0.0.exe)
npm run desktop:dist

# Run the desktop app in development mode (opens the Electron window)
npm run desktop
```

Notes:
- The installer (~99 MB) is an NSIS setup wizard: installs to a chosen folder, desktop shortcut, uninstaller.
- The server runs **inside** the Electron process on `http://localhost:5000`; the window loads that URL. Data lives in MongoDB Atlas (cloud) + IndexedDB (offline cache).
- The bundled `.env` and license keys are for the demo; for real distribution rotate `JWT_SECRET` and re-run `npm run keys` so the shipped private key is unique to your install.
- The license system still works in the desktop app — activate a license you create (see section 4) the first time it starts.

---

## 12. Notes

- Change `JWT_SECRET` in `server/.env` before production.
- The private key (`server/keys/private.pem`) must never leave the server. Delete it → all licenses become unverifiable → intentional lockdown.
- Vite proxies `/api` → `http://localhost:5000` in development. For production, build the client (`npm run build --prefix client`) and Express automatically serves `client/dist` on port 5000 — then just run `npm run server`.
- Barcode scanners that type digits + Enter work automatically in the Billing screen.
