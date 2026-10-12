/**
 * Seeds realistic DEMO data for the modules that are otherwise empty
 * (HR, Accounts, Tasks, Marketing, Edit Log) so every screen has content to
 * show. Runs per-tenant inside the tenant AsyncLocalStorage context so the
 * shared tenant plugin stamps each document with the right tenant.
 *
 * Idempotent: the module collections are cleared for the tenant before seeding.
 *
 * Usage:
 *   npm run seed:modules                 # every active tenant
 *   npm run seed:modules -- <tenantSlug> # only one tenant (e.g. default)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { runWithTenant } = require('../src/config/tenantContext');

const Tenant = require('../src/models/Tenant');
const Branch = require('../src/models/Branch');
const User = require('../src/models/User');
const Employee = require('../src/models/Employee');
const SalaryRecord = require('../src/models/SalaryRecord');
const Attendance = require('../src/models/Attendance');
const LedgerEntry = require('../src/models/LedgerEntry');
const Task = require('../src/models/Task');
const Campaign = require('../src/models/Campaign');
const AuditLog = require('../src/models/AuditLog');

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function monthKey(offset) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const EMPLOYEES = [
  { name: 'Ramesh Yadav', designation: 'Store Manager', department: 'Management', salary: 42000 },
  { name: 'Sunita Devi', designation: 'Head Cashier', department: 'Sales', salary: 24000 },
  { name: 'Amit Sharma', designation: 'Sales Executive', department: 'Sales', salary: 26000 },
  { name: 'Pooja Patel', designation: 'Accountant', department: 'Finance', salary: 33000 },
  { name: 'Vikram Singh', designation: 'Stock Keeper', department: 'Warehouse', salary: 22000 },
  { name: 'Neha Verma', designation: 'HR Executive', department: 'Human Resources', salary: 28000 },
  { name: 'Suresh Kumar', designation: 'Delivery Driver', department: 'Logistics', salary: 19000 },
  { name: 'Kavita Joshi', designation: 'Customer Support', department: 'Support', salary: 21000 },
  { name: 'Rahul Mehta', designation: 'Assistant Manager', department: 'Management', salary: 36000 },
  { name: 'Anjali Gupta', designation: 'Billing Assistant', department: 'Sales', salary: 18000 },
];

const LEDGER_INCOME = ['Counter Sales', 'Bulk Order', 'Online Order', 'Wholesale Sale'];
const LEDGER_EXPENSE = ['Shop Rent', 'Electricity Bill', 'Raw Material Purchase', 'Staff Salary', 'Transport', 'Marketing', 'Shop Maintenance', 'Packaging'];
const PAY_MODES = ['cash', 'upi', 'card', 'bank'];

const TASK_TITLES = [
  ['Restock beverage aisle', 'Check low-stock SKUs and raise a purchase order.', 'high', 'in_progress'],
  ['Monthly GST filing', 'Compile sales register and file GSTR-1 before the 11th.', 'high', 'pending'],
  ['Staff shift roster for next week', 'Publish weekly roster and confirm with all cashiers.', 'medium', 'pending'],
  ['Clean and rearrange store shelves', 'Deep-clean aisle 3-5 and reset planogram.', 'low', 'done'],
  ['Fix billing printer', 'Thermal printer skips lines on receipts.', 'high', 'in_progress'],
  ['Follow up with pending suppliers', 'Call suppliers with open POs and confirm ETA.', 'medium', 'pending'],
  ['Price update for dairy category', 'Apply the new MRP list from the vendor.', 'medium', 'done'],
  ['Reconcile UPI settlements', 'Match daily UPI payouts against invoices.', 'high', 'pending'],
  ['Train new cashier', 'Onboard Anjali on the POS hold/park flow.', 'medium', 'in_progress'],
  ['Diwali stock planning', 'Estimate festive demand and prepare order list.', 'high', 'pending'],
  ['Warranty claim for scanner', 'Raise a claim for the faulty barcode scanner.', 'low', 'pending'],
  ['Customer feedback review', 'Read this month feedback and note action points.', 'low', 'done'],
  ['Expired inventory removal', 'Pull items past expiry from shelves and log wastage.', 'high', 'in_progress'],
  ['Subscribe to cloud backup', 'Enable nightly database backups.', 'medium', 'done'],
  ['Branch audit — Thane', 'Spot-check cash drawer and stock at Thane branch.', 'medium', 'pending'],
];

const CAMPAIGNS = [
  ['Diwali Mega Offer', 'email', 'This Diwali, save up to 30% on groceries', 'queued'],
  ['Weekend Flash Sale', 'whatsapp', 'Flat 15% off this weekend only!', 'sent'],
  ['New Arrivals — Snacks', 'email', 'Fresh snack brands now in store', 'sent'],
  ['Loyalty Rewards Reminder', 'email', 'You have unclaimed reward points', 'partial'],
  ['Monsoon Essentials', 'whatsapp', 'Umbrellas, raincoats and more — grab now', 'sent'],
];

async function seedTenant(tenant) {
  const ctx = { tenantId: String(tenant._id), bypass: false, userId: null };
  return runWithTenant(ctx, async () => {
    const branches = await Branch.find({ active: { $ne: false } }).sort({ isMain: -1, name: 1 });
    const users = await User.find({}).select('name');
    const owner = users.find((u) => u.role === 'admin' || u.role === 'superadmin') || users[0] || null;
    const createdBy = owner ? owner._id : undefined;
    const mainBranch = branches[0] ? branches[0]._id : undefined;
    const branchFor = () => (branches.length ? pick(branches)._id : undefined);

    // --- clear existing demo data for a clean, repeatable seed ---
    await Promise.all([
      Employee.deleteMany({}),
      SalaryRecord.deleteMany({}),
      Attendance.deleteMany({}),
      LedgerEntry.deleteMany({}),
      Task.deleteMany({}),
      Campaign.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    // --- Employees ---
    const employees = [];
    for (let i = 0; i < EMPLOYEES.length; i++) {
      const e = EMPLOYEES[i];
      const emp = await Employee.create({
        code: `EMP${String(i + 1).padStart(3, '0')}`,
        name: e.name,
        phone: `9${rand(100000000, 999999999)}`,
        email: `${e.name.split(' ')[0].toLowerCase()}.${rand(10, 99)}@niteshpro.in`,
        designation: e.designation,
        department: e.department,
        joinDate: daysAgo(rand(60, 1200)),
        salaryType: 'monthly',
        salary: e.salary,
        address: `${rand(1, 90)}, Sector ${rand(1, 30)}, Mumbai`,
        bankAccount: `${rand(10000000000, 99999999999)}`,
        ifsc: 'HDFC0001234',
        status: i === EMPLOYEES.length - 1 ? 'inactive' : 'active',
        notes: '',
        branch: branchFor(),
        createdBy,
      });
      employees.push(emp);
    }

    // --- Salary records (last 3 months) ---
    let salaryCount = 0;
    for (const emp of employees) {
      if (emp.status !== 'active') continue;
      for (let m = 2; m >= 0; m--) {
        const basic = emp.salary;
        const allowances = Math.round(basic * 0.1);
        const deductions = m === 0 ? 0 : Math.round(basic * 0.05);
        const netPay = basic + allowances - deductions;
        const paid = m > 0;
        await SalaryRecord.create({
          employee: emp._id,
          employeeName: emp.name,
          month: monthKey(m),
          basic,
          allowances,
          deductions,
          netPay,
          status: paid ? 'paid' : 'pending',
          paidAt: paid ? daysAgo(m * 30) : undefined,
          paymentMode: paid ? pick(PAY_MODES) : 'bank',
          note: '',
          branch: emp.branch,
          createdBy,
        });
        salaryCount++;
      }
    }

    // --- Attendance (last 30 days, skip Sundays) ---
    let attCount = 0;
    for (const emp of employees) {
      if (emp.status !== 'active') continue;
      for (let d = 29; d >= 0; d--) {
        const date = daysAgo(d);
        if (date.getDay() === 0) continue; // Sunday off
        const r = Math.random();
        const status = r < 0.85 ? 'present' : r < 0.9 ? 'leave' : r < 0.95 ? 'half_day' : 'absent';
        await Attendance.create({
          employee: emp._id,
          employeeName: emp.name,
          date: ymd(date),
          status,
          note: status === 'leave' ? 'Approved leave' : '',
          branch: emp.branch,
          createdBy,
        });
        attCount++;
      }
    }

    // --- Ledger entries (last 60 days) ---
    let ledgerCount = 0;
    for (let d = 59; d >= 0; d--) {
      const date = daysAgo(d);
      // 1-3 income entries/day
      for (let k = rand(1, 3); k > 0; k--) {
        await LedgerEntry.create({
          type: 'income',
          category: pick(LEDGER_INCOME),
          amount: rand(2000, 45000),
          date,
          paymentMode: pick(PAY_MODES),
          party: pick(['Walk-in', 'Retail Customer', 'Corporate Account', 'Online Buyer']),
          reference: `INV-${rand(1000, 9999)}`,
          note: '',
          branch: branchFor(),
          createdBy,
        });
        ledgerCount++;
      }
      // 0-2 expense entries/day
      for (let k = rand(0, 2); k > 0; k--) {
        await LedgerEntry.create({
          type: 'expense',
          category: pick(LEDGER_EXPENSE),
          amount: rand(500, 22000),
          date,
          paymentMode: pick(PAY_MODES),
          party: pick(['Vendor', 'Landlord', 'Utility Board', 'Staff']),
          reference: `EXP-${rand(1000, 9999)}`,
          note: '',
          branch: branchFor(),
          createdBy,
        });
        ledgerCount++;
      }
    }

    // --- Tasks ---
    for (const [title, description, priority, status] of TASK_TITLES) {
      await Task.create({
        title,
        description,
        assignedTo: pick(EMPLOYEES).name,
        priority,
        status,
        dueDate: daysAgo(rand(-12, 20)),
        branch: mainBranch,
        createdBy,
      });
    }

    // --- Campaigns ---
    for (const [name, channel, subject, status] of CAMPAIGNS) {
      const recipients = rand(150, 900);
      const sent = status === 'queued' ? 0 : status === 'partial' ? Math.round(recipients * 0.6) : recipients;
      await Campaign.create({
        name,
        channel,
        subject,
        body: `${subject}\n\nShop now at NiteshPro SuperMart.`,
        recipients,
        sent,
        failed: status === 'partial' ? recipients - sent : 0,
        status,
        branch: mainBranch,
        createdBy,
      });
    }

    // --- Audit / edit log trail ---
    const auditSeeds = [
      ['auth.login', 'user', 'Signed in from POS terminal'],
      ['hr.employee.create', 'employee', 'Created employee record'],
      ['hr.salary.generate', 'salary', 'Generated monthly payroll'],
      ['accounts.entry.create', 'ledger', 'Added expense entry'],
      ['tasks.update', 'task', 'Task marked as done'],
      ['products.edit', 'product', 'Updated product price'],
      ['settings.edit', 'settings', 'Changed invoice footer'],
      ['branches.create', 'branch', 'Added a new branch'],
      ['backup.manage', 'backup', 'Created a database backup'],
      ['users.create', 'user', 'Invited a new staff user'],
    ];
    for (let d = 0; d < 40; d++) {
      const [action, entity, note] = pick(auditSeeds);
      const u = pick(users.length ? users : [{ name: 'System' }]);
      const at = daysAgo(rand(0, 25));
      await AuditLog.create({
        user: u._id,
        userName: u.name || 'System',
        action,
        entity,
        entityId: String(rand(1000, 9999)),
        outcome: Math.random() > 0.05 ? 'success' : 'failure',
        ip: `192.168.1.${rand(2, 250)}`,
        meta: { note },
        createdAt: at,
        updatedAt: at,
      });
    }

    return {
      employees: employees.length,
      salary: salaryCount,
      attendance: attCount,
      ledger: ledgerCount,
      tasks: TASK_TITLES.length,
      campaigns: CAMPAIGNS.length,
      audits: 40,
    };
  });
}

async function main() {
  await connectDB();
  const slug = process.argv[2];
  const filter = { status: { $ne: 'archived' } };
  if (slug) filter.slug = slug;
  const tenants = await Tenant.find(filter);

  if (!tenants.length) {
    console.log(`[seed:modules] no tenants found${slug ? ` for slug '${slug}'` : ''}`);
    await mongoose.connection.close();
    return;
  }

  for (const t of tenants) {
    console.log(`\n[seed:modules] tenant '${t.slug}' (${t._id})`);
    const res = await seedTenant(t);
    console.log(
      `  ✓ employees ${res.employees}, salary ${res.salary}, attendance ${res.attendance}, ` +
        `ledger ${res.ledger}, tasks ${res.tasks}, campaigns ${res.campaigns}, audit ${res.audits}`
    );
  }

  console.log('\n[seed:modules] done.');
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error('[seed:modules] failed:', err);
  process.exit(1);
});
