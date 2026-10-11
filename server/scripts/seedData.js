require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');

const Branch = require('../src/models/Branch');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Customer = require('../src/models/Customer');
const Sale = require('../src/models/Sale');
const Purchase = require('../src/models/Purchase');
const Setting = require('../src/models/Setting');
const Counter = require('../src/models/Counter');

const BRANCHES = [
  { name: 'Main Outlet', code: 'MAIN', city: 'Mumbai', area: 'Andheri West' },
  { name: 'Bandra Branch', code: 'BAND', city: 'Mumbai', area: 'Bandra Linking Road' },
  { name: 'Thane Branch', code: 'THAN', city: 'Thane', area: 'Ghodbunder Road' },
  { name: 'Pune Branch', code: 'PUNE', city: 'Pune', area: 'FC Road' },
  { name: 'Delhi Branch', code: 'DELH', city: 'New Delhi', area: 'Karol Bagh' },
  { name: 'Bangalore Branch', code: 'BLR', city: 'Bangalore', area: 'Indiranagar' },
];

const CATEGORIES = [
  'Beverages',
  'Grocery',
  'Snacks',
  'Dairy',
  'Personal Care',
  'Household',
  'Stationery',
  'Bakery',
];

const PRODUCTS = {
  Beverages: [
    ['Coca Cola 500ml', 'Cold Drink', 25, 35, 12],
    ['Pepsi 500ml', 'Cold Drink', 24, 34, 12],
    ['Mirinda 500ml', 'Cold Drink', 24, 34, 12],
    ['Sprite 500ml', 'Cold Drink', 24, 34, 12],
    ['Fanta 500ml', 'Cold Drink', 24, 34, 12],
    ['Amul Milk 500ml', 'Milk', 28, 32, 0],
    ['Bisleri Water 1L', 'Water', 12, 20, 0],
    ['Frooti 200ml', 'Juice', 12, 15, 12],
    ['Maaza 200ml', 'Juice', 12, 15, 12],
    ['Real Juice 1L', 'Juice', 90, 110, 12],
    ['Tata Tea Premium 250g', 'Tea', 85, 105, 5],
    ['Nescafe Classic 50g', 'Coffee', 135, 160, 18],
    ['Red Bull 250ml', 'Energy', 95, 115, 28],
    ['Thums Up 500ml', 'Cold Drink', 24, 34, 12],
    ['Slice 200ml', 'Juice', 25, 30, 12],
  ],
  Grocery: [
    ['Aashirvaad Atta 5kg', 'Flour', 210, 245, 5],
    ['Basmati Rice 5kg', 'Rice', 380, 440, 5],
    ['Toor Dal 1kg', 'Pulses', 120, 145, 5],
    ['Moong Dal 1kg', 'Pulses', 110, 130, 5],
    ['Chana Dal 1kg', 'Pulses', 90, 110, 5],
    ['Sunflower Oil 1L', 'Oil', 130, 155, 5],
    ['Mustard Oil 1L', 'Oil', 145, 170, 5],
    ['Tata Salt 1kg', 'Salt', 22, 28, 5],
    ['Sugar 1kg', 'Sugar', 40, 48, 5],
    ['Masoor Dal 1kg', 'Pulses', 95, 115, 5],
    ['Poha 500g', 'Snacks', 30, 38, 5],
    ['Rava 500g', 'Grocery', 28, 35, 5],
    ['Besan 500g', 'Grocery', 45, 55, 5],
    ['Sabudana 500g', 'Grocery', 55, 68, 5],
    ['Jaggery 500g', 'Grocery', 35, 45, 5],
  ],
  Snacks: [
    ['Parle-G 250g', 'Biscuits', 20, 25, 18],
    ['Britannia Good Day 250g', 'Biscuits', 35, 45, 18],
    ['Oreo 120g', 'Biscuits', 30, 40, 18],
    ['Marie Gold 250g', 'Biscuits', 25, 32, 18],
    ['Lays Classic 52g', 'Chips', 20, 25, 12],
    ['Kurkure Masala 90g', 'Chips', 20, 25, 12],
    ['Bingo Mad Angles 100g', 'Chips', 20, 25, 12],
    ['Haldiram Bhujia 200g', 'Namkeen', 50, 62, 12],
    ['Haldiram Aloo Bhujia 200g', 'Namkeen', 50, 62, 12],
    ['Dairy Milk 40g', 'Chocolate', 35, 45, 18],
    ['KitKat 27g', 'Chocolate', 20, 25, 18],
    ['5 Star 22g', 'Chocolate', 10, 15, 18],
    ['Perk 22g', 'Chocolate', 10, 15, 18],
    ['Munch 20g', 'Chocolate', 10, 15, 18],
    ['Popcorn 100g', 'Snacks', 30, 40, 12],
  ],
  Dairy: [
    ['Amul Butter 100g', 'Butter', 52, 60, 12],
    ['Amul Cheese 200g', 'Cheese', 120, 140, 12],
    ['Amul Ghee 500ml', 'Ghee', 280, 320, 5],
    ['Nestle Dahi 400g', 'Curd', 35, 45, 5],
    ['Amul Paneer 200g', 'Paneer', 85, 100, 5],
    ['Go Cheese 200g', 'Cheese', 110, 130, 12],
    ['Mother Dairy Milk 500ml', 'Milk', 27, 30, 0],
    ['Amul Taaza Milk 1L', 'Milk', 62, 68, 0],
    ['Nestle Milkmaid 400g', 'Dairy', 135, 155, 12],
    ['Epigamia Yogurt 100g', 'Yogurt', 40, 50, 12],
  ],
  'Personal Care': [
    ['Colgate Toothpaste 100g', 'Oral', 55, 68, 18],
    ['Pepsodent 100g', 'Oral', 50, 62, 18],
    ['Lux Soap 100g', 'Soap', 30, 38, 18],
    ['Dove Soap 100g', 'Soap', 48, 58, 18],
    ['Dettol Soap 100g', 'Soap', 38, 48, 18],
    ['Head & Shoulders 180ml', 'Shampoo', 145, 175, 18],
    ['Clinic Plus 175ml', 'Shampoo', 95, 115, 18],
    ['Nivea Cream 60ml', 'Cream', 90, 110, 18],
    ['Ponds Powder 100g', 'Powder', 65, 80, 18],
    ['Gillette Razor', 'Shaving', 40, 55, 18],
    ['Axe Deodorant 150ml', 'Deodorant', 165, 195, 18],
    ['Santoor Talcum 100g', 'Powder', 55, 68, 18],
  ],
  Household: [
    ['Surf Excel 1kg', 'Detergent', 105, 125, 18],
    ['Ariel 1kg', 'Detergent', 110, 130, 18],
    ['Rin Bar 250g', 'Detergent', 20, 26, 18],
    ['Vim Dishwash Bar 200g', 'Dishwash', 15, 20, 18],
    ['Vim Liquid 500ml', 'Dishwash', 95, 115, 18],
    ['Harpic 500ml', 'Toilet Cleaner', 85, 100, 18],
    ['Lizol 500ml', 'Floor Cleaner', 95, 115, 18],
    ['Colin Glass Cleaner 500ml', 'Cleaner', 85, 100, 18],
    ['Good Knight Refill', 'Repellent', 65, 80, 18],
    ['Odomos 100ml', 'Repellent', 75, 90, 18],
    ['Scotch Brite Scrub', 'Cleaning', 20, 28, 18],
    ['Garbage Bags 30pc', 'Cleaning', 45, 58, 18],
  ],
  Stationery: [
    ['Reynolds Pen Blue', 'Pen', 5, 10, 12],
    ['Cello Pen Black', 'Pen', 5, 10, 12],
    ['Camlin Pencil', 'Pencil', 3, 6, 12],
    ['Apsara Eraser', 'Eraser', 3, 6, 12],
    ['Doms Sharpener', 'Sharpener', 5, 10, 12],
    ['Classmate Notebook 200pg', 'Notebook', 45, 60, 12],
    ['A4 Paper Ream 500', 'Paper', 220, 260, 12],
    ['Fevicol 100g', 'Adhesive', 35, 45, 12],
    ['Fevistick 15g', 'Adhesive', 25, 35, 12],
    ['Stapler Small', 'Office', 55, 75, 12],
    ['Geometry Box', 'School', 90, 120, 12],
    ['Sketch Pens 12pc', 'Art', 65, 90, 12],
  ],
  Bakery: [
    ['Britannia Bread 400g', 'Bread', 35, 42, 5],
    ['Modern Bread 400g', 'Bread', 32, 40, 5],
    ['Bun 4pc', 'Bakery', 20, 28, 5],
    ['Rusk 200g', 'Bakery', 30, 40, 5],
    ['Cake Slice', 'Bakery', 25, 35, 5],
    ['Croissant', 'Bakery', 40, 55, 5],
  ],
};

const FIRST_NAMES = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vijay', 'Anjali', 'Suresh', 'Kavita', 'Ramesh', 'Pooja', 'Arjun', 'Neha', 'Karan', 'Divya', 'Nikhil', 'Ritu', 'Manoj', 'Deepa', 'Sanjay', 'Meena', 'Arun', 'Swati', 'Vikram', 'Anita', 'Rohit'];
const LAST_NAMES = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Verma', 'Joshi', 'Desai', 'Mehta', 'Shah', 'Reddy', 'Nair', 'Iyer', 'Rao', 'Das', 'Bose', 'Chopra', 'Malhotra', 'Kapoor', 'Agarwal'];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - rand(0, daysBack));
  d.setHours(rand(8, 21), rand(0, 59), rand(0, 59), 0);
  return d;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function computeSaleTotals(items, orderDiscount) {
  let subtotal = 0;
  const gstBuckets = {};
  const normalized = items.map((it) => {
    const gross = it.qty * it.price;
    const discounted = Math.max(0, gross - (it.lineDiscount || 0));
    const gstAmount = Math.round(discounted * (it.gstRate / 100) * 100) / 100;
    subtotal += gross;
    return { ...it, gstAmount, total: Math.round((discounted + gstAmount) * 100) / 100 };
  });
  const discount = Math.min(orderDiscount || 0, subtotal);
  const taxable = Math.max(0, subtotal - discount);
  for (const it of normalized) {
    const rate = it.gstRate;
    const base = ((it.price * it.qty - (it.lineDiscount || 0)) / (subtotal || 1)) * taxable;
    gstBuckets[rate] = (gstBuckets[rate] || 0) + Math.round(base * (rate / 100) * 100) / 100;
  }
  let gstTotal = Object.values(gstBuckets).reduce((a, b) => a + b, 0);
  gstTotal = Math.round(gstTotal * 100) / 100;
  const total = Math.round((taxable + gstTotal) * 100) / 100;
  return {
    items: normalized,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    taxable: Math.round(taxable * 100) / 100,
    gstTotal,
    total,
  };
}

async function clearData() {
  console.log('Clearing existing data...');
  await Promise.all([
    Sale.deleteMany({}),
    Purchase.deleteMany({}),
    Product.deleteMany({}),
    Customer.deleteMany({}),
    Category.deleteMany({}),
    Branch.deleteMany({}),
    Counter.deleteMany({}),
  ]);
  // Drop auto-created indexes so schema index changes (branch-scoped unique
  // indexes on Category/Product) take effect cleanly.
  for (const Model of [Category, Product]) {
    try {
      await Model.collection.dropIndexes();
    } catch {
      /* ignore missing */
    }
  }
  await User.deleteMany({ username: { $ne: 'owner' } });
  console.log('Cleared.');
}

async function seed() {
  await connectDB();
  await clearData();

  const hash = (p) => bcrypt.hash(p, Number(process.env.BCRYPT_ROUNDS) || 10);

  const owner = await User.findOne({ username: 'owner' });
  if (!owner) {
    await User.create({
      name: 'System Owner',
      username: 'owner',
      passwordHash: await hash('owner123'),
      role: 'superadmin',
      permissions: ['*'],
    });
    console.log('Created superadmin: owner / owner123');
  }

  // ===== BRANCHES =====
  console.log('\nCreating branches...');
  const branches = [];
  for (let i = 0; i < BRANCHES.length; i++) {
    const b = BRANCHES[i];
    const branch = await Branch.create({
      clientId: `br_${b.code.toLowerCase()}_${Date.now()}`,
      name: b.name,
      code: b.code,
      address: `${b.area}, ${b.city}, India`,
      phone: `9${rand(100000000, 999999999)}`,
      email: `${b.code.toLowerCase()}@niteshpro.com`,
      gstin: `27ABC${String.fromCharCode(65 + i)}${rand(1000, 9999)}${String.fromCharCode(65 + i)}1Z${i}`,
      isMain: i === 0,
      isActive: true,
      settings: {
        invoicePrefix: b.code,
        lowStockThreshold: 10,
      },
    });
    branches.push(branch);
    console.log(`  ✓ ${branch.name} (${branch.code})`);
  }

  // ===== USERS =====
  console.log('\nCreating users...');
  const users = [];

  const admins = [
    { name: 'Nitesh Kumar', username: 'admin', password: 'admin123', branch: 0 },
    { name: 'Rajesh Verma', username: 'rajesh', password: 'rajesh123', branch: 1 },
  ];
  for (const a of admins) {
    const u = await User.create({
      name: a.name,
      username: a.username,
      email: `${a.username}@niteshpro.com`,
      passwordHash: await hash(a.password),
      role: 'admin',
      branch: branches[a.branch]._id,
      permissions: [
        'sales.create', 'sales.view', 'sales.delete', 'sales.hold', 'sales.park',
        'products.create', 'products.view', 'products.edit', 'products.delete',
        'categories.create', 'categories.view', 'categories.edit', 'categories.delete',
        'customers.create', 'customers.view', 'customers.edit', 'customers.delete',
        'purchases.create', 'purchases.view', 'purchases.edit', 'purchases.delete',
        'inventory.view', 'inventory.adjust', 'inventory.transfer',
        'reports.view', 'reports.export',
        'users.create', 'users.view', 'users.edit', 'users.delete',
        'branches.view', 'settings.view', 'settings.edit',
        'dashboard.view', 'license.manage',
      ],
    });
    users.push(u);
    console.log(`  ✓ ${u.name} / ${a.username} (admin)`);
  }

  const managers = [
    { name: 'Sunil Deshmukh', username: 'sunil', password: 'sunil123', branch: 2 },
    { name: 'Prakash Nair', username: 'prakash', password: 'prakash123', branch: 3 },
    { name: 'Anil Kulkarni', username: 'anil', password: 'anil123', branch: 4 },
  ];
  for (const m of managers) {
    const u = await User.create({
      name: m.name,
      username: m.username,
      email: `${m.username}@niteshpro.com`,
      passwordHash: await hash(m.password),
      role: 'manager',
      branch: branches[m.branch]._id,
      permissions: [
        'sales.create', 'sales.view', 'sales.hold', 'sales.park',
        'products.view', 'products.edit',
        'categories.view', 'categories.edit',
        'customers.create', 'customers.view', 'customers.edit',
        'purchases.create', 'purchases.view', 'purchases.edit',
        'inventory.view', 'inventory.adjust', 'inventory.transfer',
        'reports.view', 'reports.export',
        'users.view', 'branches.view', 'settings.view', 'dashboard.view',
      ],
    });
    users.push(u);
    console.log(`  ✓ ${u.name} / ${m.username} (manager)`);
  }

  const cashiers = [
    { name: 'Ravi Sharma', username: 'ravi', password: 'ravi123', pin: '1234', branch: 0 },
    { name: 'Sita Patel', username: 'sita', password: 'sita123', pin: '2345', branch: 1 },
    { name: 'Ganesh More', username: 'ganesh', password: 'ganesh123', pin: '3456', branch: 2 },
    { name: 'Kavita Joshi', username: 'kavita', password: 'kavita123', pin: '4567', branch: 3 },
    { name: 'Deepak Reddy', username: 'deepak', password: 'deepak123', pin: '5678', branch: 4 },
    { name: 'Anita Das', username: 'anita', password: 'anita123', pin: '6789', branch: 5 },
  ];
  for (const c of cashiers) {
    const u = await User.create({
      name: c.name,
      username: c.username,
      email: `${c.username}@niteshpro.com`,
      passwordHash: await hash(c.password),
      pin: await hash(c.pin),
      role: 'cashier',
      branch: branches[c.branch]._id,
      permissions: [
        'sales.create', 'sales.view', 'sales.hold', 'sales.park',
        'products.view', 'categories.view',
        'customers.create', 'customers.view', 'purchases.view',
        'inventory.view', 'dashboard.view',
      ],
    });
    users.push(u);
    console.log(`  ✓ ${u.name} / ${c.username} (cashier) PIN: ${c.pin}`);
  }

  // ===== CATEGORIES & PRODUCTS (per branch) =====
  console.log('\nCreating categories & products...');
  let productCount = 0;
  let prodSeq = 0;
  const branchProducts = {};

  for (const branch of branches) {
    branchProducts[branch._id] = [];
    for (const catName of CATEGORIES) {
      const category = await Category.create({
        clientId: `cat_${branch.code}_${slugify(catName)}`,
        branch: branch._id,
        name: catName,
        slug: `${branch.code.toLowerCase()}-${slugify(catName)}`,
        description: `${catName} items for ${branch.name}`,
      });

      const productDefs = PRODUCTS[catName] || [];
      for (const [name, subcat, pp, sp, gst] of productDefs) {
        prodSeq++;
        const sku = `${branch.code}-${catName.slice(0, 3).toUpperCase()}-${String(prodSeq).padStart(4, '0')}`;
        const stock = rand(0, 200);
        const product = await Product.create({
          clientId: `prod_${branch.code}_${slugify(name)}_${rand(100, 999)}`,
          categoryClientId: category.clientId,
          branch: branch._id,
          name,
          sku,
          barcode: String(rand(890000000000, 899999999999)),
          category: category._id,
          categoryName: catName,
          purchasePrice: pp,
          sellingPrice: sp,
          gstRate: gst,
          stock,
          minStock: rand(5, 25),
          isLowStock: stock <= 20,
          active: true,
        });
        branchProducts[branch._id].push(product);
        productCount++;
      }
    }
  }
  console.log(`  ✓ Created ${productCount} products across ${branches.length} branches`);

  // ===== CUSTOMERS =====
  console.log('\nCreating customers...');
  let customerCount = 0;
  const branchCustomers = {};

  for (const branch of branches) {
    branchCustomers[branch._id] = [];
    const numCustomers = rand(15, 30);
    for (let i = 0; i < numCustomers; i++) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const name = `${first} ${last}`;
      const customer = await Customer.create({
        clientId: `cust_${branch.code}_${Date.now()}_${i}_${rand(100, 999)}`,
        branch: branch._id,
        name,
        mobile: `9${rand(100000000, 999999999)}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${rand(10, 99)}@gmail.com`,
        address: `${rand(1, 500)}, ${pick(['MG Road', 'Nehru Nagar', 'Gandhi Chowk', 'Lake View', 'Green Park'])}, ${branch.address.split(',').slice(-2).join(',')}`,
        gstNumber: Math.random() > 0.7 ? `27ABCDE${rand(1000, 9999)}F1Z${rand(1, 9)}` : '',
      });
      branchCustomers[branch._id].push(customer);
      customerCount++;
    }
  }
  console.log(`  ✓ Created ${customerCount} customers`);

  // ===== PURCHASES (stock-in records) =====
  console.log('\nCreating purchase records...');
  let purchaseCount = 0;
  for (const branch of branches) {
    const products = branchProducts[branch._id];
    const branchUsers = users.filter((u) => u.branch && u.branch.toString() === branch._id.toString());
    const numPurchases = rand(20, 40);
    for (let i = 0; i < numPurchases; i++) {
      const p = pick(products);
      const qty = rand(10, 100);
      const user = branchUsers.length ? pick(branchUsers) : users[0];
      await Purchase.create({
        clientId: `pur_${branch.code}_${Date.now()}_${i}_${rand(100, 999)}`,
        productClientId: p.clientId,
        branch: branch._id,
        product: p._id,
        name: p.name,
        sku: p.sku,
        supplierName: pick(['Sharma Distributors', 'Krishna Traders', 'Balaji Agencies', 'Metro Wholesale', 'Gupta Suppliers']),
        type: pick(['purchase', 'purchase', 'purchase', 'opening', 'adjustment']),
        qty,
        costPrice: p.purchasePrice,
        total: qty * p.purchasePrice,
        note: 'Auto-seeded stock record',
        user: user._id,
        userName: user.name,
        createdAt: randDate(90),
        updatedAt: randDate(90),
      });
      purchaseCount++;
    }
  }
  console.log(`  ✓ Created ${purchaseCount} purchase records`);

  // ===== SALES =====
  console.log('\nCreating sales...');
  let saleCount = 0;
  let counterSeq = 0;

  for (const branch of branches) {
    const products = branchProducts[branch._id];
    const customers = branchCustomers[branch._id];
    const branchUsers = users.filter((u) => u.branch && u.branch.toString() === branch._id.toString());
    const numSales = rand(80, 150);

    for (let i = 0; i < numSales; i++) {
      const numItems = rand(1, 6);
      const chosen = [];
      const usedSkus = new Set();
      for (let j = 0; j < numItems; j++) {
        let p;
        let attempts = 0;
        do {
          p = pick(products);
          attempts++;
        } while (usedSkus.has(p.sku) && attempts < 10);
        if (usedSkus.has(p.sku)) continue;
        usedSkus.add(p.sku);
        chosen.push(p);
      }

      const items = chosen.map((p) => {
        const qty = rand(1, 5);
        return {
          product: p._id,
          productClientId: p.clientId,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          qty,
          price: p.sellingPrice,
          purchasePrice: p.purchasePrice,
          gstRate: p.gstRate,
          lineDiscount: Math.random() > 0.85 ? rand(5, 30) : 0,
        };
      });

      const orderDiscount = Math.random() > 0.8 ? rand(10, 100) : 0;
      const totals = computeSaleTotals(items, orderDiscount);
      const saleDate = randDate(60);
      const paymentMode = pick(['cash', 'cash', 'cash', 'upi', 'upi', 'card']);
      const withCustomer = Math.random() > 0.6;
      const customer = withCustomer && customers.length ? pick(customers) : null;
      const cashier = branchUsers.length ? pick(branchUsers) : users[0];

      counterSeq++;
      const ymd = `${saleDate.getFullYear()}${String(saleDate.getMonth() + 1).padStart(2, '0')}${String(saleDate.getDate()).padStart(2, '0')}`;
      const invoiceNo = `${branch.code}-${ymd}-${String(counterSeq).padStart(4, '0')}`;
      const amountReceived = paymentMode === 'cash' ? Math.ceil(totals.total / 10) * 10 : totals.total;

      await Sale.create({
        invoiceNo,
        clientSaleId: `${branch.code}-${saleDate.getTime()}-${i}`,
        branch: branch._id,
        customer: customer ? customer._id : undefined,
        customerClientId: customer ? customer.clientId : undefined,
        customerSnapshot: customer
          ? { name: customer.name, mobile: customer.mobile, gstNumber: customer.gstNumber, address: customer.address }
          : { name: 'Walk-in Customer' },
        items: totals.items,
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxable: totals.taxable,
        gstTotal: totals.gstTotal,
        total: totals.total,
        paymentMode,
        amountReceived,
        changeDue: Math.round((amountReceived - totals.total) * 100) / 100,
        cashier: cashier._id,
        cashierName: cashier.name,
        deviceId: `device-${branch.code}-01`,
        syncSource: 'online',
        syncedAt: saleDate,
        createdAt: saleDate,
        updatedAt: saleDate,
      });

      if (customer) {
        customer.totalPurchases = (customer.totalPurchases || 0) + totals.total;
        if (!customer.lastPurchaseAt || saleDate > customer.lastPurchaseAt) {
          customer.lastPurchaseAt = saleDate;
        }
      }
      saleCount++;
    }

    for (const c of customers) {
      await c.save();
    }
  }
  console.log(`  ✓ Created ${saleCount} sales`);

  // ===== SETTINGS =====
  console.log('\nUpdating business settings...');
  await Setting.findOneAndUpdate(
    { key: 'business' },
    {
      key: 'business',
      businessName: 'NiteshPro SuperMart',
      address: 'Shop No. 1, Main Market, Andheri West, Mumbai - 400058',
      phone: '9876543210',
      gstin: '27ABCDE1234F1Z5',
      footerNote: 'Thank you for shopping with NiteshPro! Visit again.',
      currency: '₹',
      invoicePrefix: 'INV',
    },
    { upsert: true }
  );
  console.log('  ✓ Settings saved');

  console.log('\n========================================');
  console.log('  SEED COMPLETE');
  console.log('========================================');
  console.log(`  Branches : ${branches.length}`);
  console.log(`  Users    : ${users.length + 1} (incl. owner)`);
  console.log(`  Products : ${productCount}`);
  console.log(`  Customers: ${customerCount}`);
  console.log(`  Purchases: ${purchaseCount}`);
  console.log(`  Sales    : ${saleCount}`);
  console.log('----------------------------------------');
  console.log('  LOGIN CREDENTIALS');
  console.log('  Superadmin : owner / owner123');
  console.log('  Admin      : admin / admin123  (Nitesh Kumar)');
  console.log('  Admin      : rajesh / rajesh123');
  console.log('  Manager    : sunil / sunil123');
  console.log('  Cashier    : ravi / ravi123    (PIN 1234)');
  console.log('  Cashier    : sita / sita123    (PIN 2345)');
  console.log('========================================\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});