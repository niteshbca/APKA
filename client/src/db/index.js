/* Minimal promise-based IndexedDB wrapper with automatic schema versioning. */

const DB_NAME = 'pos_offline_db';
const DB_VERSION = 3;

const STORES = {
  products: { keyPath: 'sku', indexes: [{ name: 'name', keyPath: 'name' }] },
  categories: { keyPath: 'id' },
  customers: { keyPath: 'id' },
  users: { keyPath: 'id' },
  sales: { keyPath: 'clientSaleId', indexes: [{ name: 'createdAt', keyPath: 'createdAt' }, { name: 'invoiceNo', keyPath: 'invoiceNo' }] },
  invoices: { keyPath: 'invoiceNo' },
  purchases: { keyPath: 'id' },
  stockTransactions: { keyPath: 'id' },
  outbox: { keyPath: 'clientOpId', indexes: [{ name: 'status', keyPath: 'status' }] },
  settings: { keyPath: 'key' },
  syncState: { keyPath: 'key' },
  counters: { keyPath: 'key' },
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, cfg] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: cfg.keyPath });
          for (const idx of cfg.indexes || []) store.createIndex(idx.name, idx.keyPath, { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode = 'readonly', fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const result = fn(store);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async put(storeName, value) {
    return tx(storeName, 'readwrite', (s) => reqToPromise(s.put(value)));
  },
  async putMany(storeName, values) {
    if (!values || !values.length) return;
    const dbh = await openDB();
    return new Promise((resolve, reject) => {
      const t = dbh.transaction(storeName, 'readwrite');
      const s = t.objectStore(storeName);
      values.forEach((v) => s.put(v));
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  },
  async get(storeName, key) {
    return tx(storeName, 'readonly', (s) => reqToPromise(s.get(key)));
  },
  async getAll(storeName) {
    return tx(storeName, 'readonly', (s) => reqToPromise(s.getAll()));
  },
  async getAllKeys(storeName) {
    return tx(storeName, 'readonly', (s) => reqToPromise(s.getAllKeys()));
  },
  async getAllFromIndex(storeName, indexName, key) {
    const dbh = await openDB();
    return new Promise((resolve, reject) => {
      const t = dbh.transaction(storeName, 'readonly');
      const s = t.objectStore(storeName);
      const idx = s.index(indexName);
      const req = key === undefined ? idx.getAll() : idx.getAll(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async delete(storeName, key) {
    return tx(storeName, 'readwrite', (s) => reqToPromise(s.delete(key)));
  },
  async clear(storeName) {
    return tx(storeName, 'readwrite', (s) => reqToPromise(s.clear()));
  },
  async update(storeName, key, patch) {
    const existing = await this.get(storeName, key);
    await this.put(storeName, { ...(existing || {}), ...patch, [STORES[storeName].keyPath]: key });
  },
  async bulkDeleteNotIn(storeName, keepKeys) {
    const all = await this.getAllKeys(storeName);
    const set = new Set(keepKeys);
    const remove = all.filter((k) => !set.has(k));
    const dbh = await openDB();
    return new Promise((resolve, reject) => {
      const t = dbh.transaction(storeName, 'readwrite');
      const s = t.objectStore(storeName);
      remove.forEach((k) => s.delete(k));
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  },
  stores: STORES,
  open: openDB,
};

export default db;
