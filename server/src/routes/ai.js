const express = require('express');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const Task = require('../models/Task');
const LedgerEntry = require('../models/LedgerEntry');
const { verifyToken, requirePermission, requireModule } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);
router.use(requireModule('ai'));

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Rule-based business assistant. Answers common questions from live tenant data.
 * Deliberately dependency-free (no external LLM) so it works offline on-premise.
 */
async function answer(message) {
  const text = String(message || '').toLowerCase();

  const has = (...words) => words.some((w) => text.includes(w));

  if (has('hello', 'hi ', 'hey', 'namaste', 'hii')) {
    return { reply: 'Namaste! Main aapka business assistant hoon. Aap sales, stock, profit, customers, staff ya tasks ke baare me pooch sakte hain. Example: "aaj ki sale", "low stock", "top products".' };
  }

  if (has('low stock', 'lowstock', 'reorder', 'out of stock', 'khatam', 'stock kam')) {
    const products = await Product.find({ $expr: { $lte: ['$stock', '$minStock'] } }).sort({ stock: 1 }).limit(15);
    if (!products.length) return { reply: 'Achhi khabar — abhi koi product low stock me nahi hai. ✅' };
    const lines = products.map((p) => `• ${p.name} — ${p.stock} ${p.unit || 'pcs'} left (min ${p.minStock})`);
    return { reply: `${products.length} products low stock me hain:\n${lines.join('\n')}`, data: { count: products.length } };
  }

  if (has('stock')) {
    const [total, low] = await Promise.all([
      Product.countDocuments({ active: true }),
      Product.countDocuments({ $expr: { $lte: ['$stock', '$minStock'] } }),
    ]);
    const value = await Product.find({ active: true }, 'stock purchasePrice');
    const stockValue = value.reduce((s, p) => s + (p.stock || 0) * (p.purchasePrice || 0), 0);
    return { reply: `Kul ${total} active products hain. ${low} low stock me hain. Inventory value (cost) ~ ${inr(stockValue)}.` };
  }

  if (has('top product', 'best sell', 'best product', 'sabse zyada', 'top selling')) {
    const since = startOfMonth();
    const sales = await Sale.find({ createdAt: { $gte: since } }, 'items');
    const tally = {};
    for (const s of sales) for (const it of s.items || []) tally[it.name] = (tally[it.name] || 0) + (it.qty || 0);
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!top.length) return { reply: 'Is mahine abhi tak koi sale record nahi hui.' };
    return { reply: `Is mahine ke top products:\n${top.map(([n, q], i) => `${i + 1}. ${n} — ${q} units`).join('\n')}` };
  }

  if (has('profit', 'margin', 'munafa', 'kamai')) {
    const since = startOfMonth();
    const sales = await Sale.find({ createdAt: { $gte: since } }, 'items total');
    let revenue = 0;
    let cost = 0;
    for (const s of sales) {
      revenue += s.total || 0;
      for (const it of s.items || []) cost += (it.purchasePrice || 0) * (it.qty || 0);
    }
    const expenses = await LedgerEntry.find({ type: 'expense', date: { $gte: since } }, 'amount');
    const expenseTotal = expenses.reduce((a, e) => a + (e.amount || 0), 0);
    const gross = revenue - cost;
    return { reply: `Is mahine:\n• Revenue: ${inr(revenue)}\n• Cost of goods: ${inr(cost)}\n• Gross profit: ${inr(gross)}\n• Other expenses: ${inr(expenseTotal)}\n• Net profit: ${inr(gross - expenseTotal)}` };
  }

  if (has('expense', 'kharch', 'kharcha')) {
    const since = startOfMonth();
    const rows = await LedgerEntry.find({ type: 'expense', date: { $gte: since } }, 'amount category');
    const total = rows.reduce((a, e) => a + (e.amount || 0), 0);
    const byCat = {};
    for (const r of rows) byCat[r.category || 'Uncategorised'] = (byCat[r.category || 'Uncategorised'] || 0) + r.amount;
    const detail = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) => `• ${c}: ${inr(v)}`).join('\n');
    return { reply: `Is mahine kul kharch: ${inr(total)}${detail ? `\nTop categories:\n${detail}` : ''}` };
  }

  if (has('customer', 'grahak', 'client')) {
    const [count, recent] = await Promise.all([
      Customer.countDocuments({}),
      Customer.find({}).sort({ createdAt: -1 }).limit(1),
    ]);
    const last = recent[0] ? ` Last added: ${recent[0].name}.` : '';
    return { reply: `Aapke paas kul ${count} customers hain.${last}` };
  }

  if (has('employee', 'staff', 'hr', 'team')) {
    const [active, monthly] = await Promise.all([
      Employee.countDocuments({ status: 'active' }),
      Employee.find({ status: 'active' }, 'salary salaryType'),
    ]);
    const payroll = monthly.reduce((s, e) => s + (e.salaryType === 'monthly' ? e.salary || 0 : 0), 0);
    return { reply: `Aapke {active} active staff members hain. Estimated monthly payroll: ${inr(payroll)}.`.replace('{active}', active) };
  }

  if (has('task', 'pending work', 'kaam')) {
    const [pending, overdue] = await Promise.all([
      Task.countDocuments({ status: { $ne: 'done' } }),
      Task.countDocuments({ status: { $ne: 'done' }, dueDate: { $lt: new Date() } }),
    ]);
    return { reply: `Aapke paas ${pending} pending tasks hain${overdue ? `, jisme ${overdue} overdue hain ⚠️` : ''}.` };
  }

  if (has('month', 'mahina', 'this month')) {
    const since = startOfMonth();
    const sales = await Sale.find({ createdAt: { $gte: since } }, 'total');
    const total = sales.reduce((a, s) => a + (s.total || 0), 0);
    return { reply: `Is mahine abhi tak: ${sales.length} sales, total revenue ${inr(total)}.` };
  }

  if (has('sale', 'sales', 'revenue', 'turnover', 'bikri', 'aaj')) {
    const since = has('today', 'aaj') ? startOfToday() : startOfMonth();
    const sales = await Sale.find({ createdAt: { $gte: since } }, 'total');
    const total = sales.reduce((a, s) => a + (s.total || 0), 0);
    const label = has('today', 'aaj') ? 'Aaj' : 'Is mahine';
    return { reply: `${label}: ${sales.length} sales hui, total revenue ${inr(total)}.` };
  }

  return {
    reply: 'Main ye samajh nahi paya. Aap try karein:\n• "aaj ki sale"\n• "is mahine ka profit"\n• "low stock"\n• "top products"\n• "kitne customers"\n• "pending tasks"',
  };
}

router.post('/chat', requirePermission('ai.use', 'settings.view'), async (req, res, next) => {
  try {
    const result = await answer(req.body.message);
    res.json({ success: true, reply: result.reply, data: result.data || null });
  } catch (err) { next(err); }
});

router.get('/suggestions', requirePermission('ai.view', 'settings.view'), (req, res) => {
  res.json({
    success: true,
    data: [
      'Aaj ki sale batao',
      'Is mahine ka profit',
      'Low stock wale products',
      'Top selling products',
      'Kitne customers hain',
      'Active staff count',
      'Pending tasks',
      'Is mahine ka kharch',
    ],
  });
});

module.exports = router;
