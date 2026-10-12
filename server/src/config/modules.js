/**
 * Centralized module registry.
 *
 * The sidebar, route guards and backend `requireModule` middleware all derive
 * from this single source of truth. A tenant's `enabledModules` array holds the
 * subset that is switched on for that tenant (driven by their subscription
 * plan / admin configuration).
 */
const MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊', group: 'Core', default: true },
  { key: 'admin', label: 'Admin', icon: '🛡️', group: 'Administration', default: true },
  { key: 'ai', label: 'AI Assistant', icon: '🤖', group: 'Intelligence', default: false },
  { key: 'crm', label: 'CRM', icon: '👥', group: 'Revenue', default: true },
  { key: 'master', label: 'Master Data', icon: '🗃️', group: 'Configuration', default: true },
  { key: 'sales', label: 'Sales & POS', icon: '🧾', group: 'Revenue', default: true },
  { key: 'products', label: 'Products', icon: '📦', group: 'Revenue', default: true },
  { key: 'purchases', label: 'Purchases', icon: '📥', group: 'Supply', default: true },
  { key: 'inventory', label: 'Inventory', icon: '🏬', group: 'Supply', default: true },
  { key: 'invoices', label: 'Invoices', icon: '📄', group: 'Revenue', default: true },
  { key: 'labels', label: 'Label Printing', icon: '🏷️', group: 'Revenue', default: true },
  { key: 'accounts', label: 'Accounts', icon: '💰', group: 'Finance', default: false },
  { key: 'hr', label: 'HR & Staff', icon: '👷', group: 'People', default: false },
  { key: 'operations', label: 'Operations', icon: '⚙️', group: 'Operations', default: false },
  { key: 'tasks', label: 'Tasks & Work Assignment', icon: '✅', group: 'Operations', default: false },
  { key: 'marketing', label: 'Marketing & Communication', icon: '📣', group: 'Revenue', default: true },
  { key: 'reports', label: 'Reports & Analytics', icon: '📈', group: 'Intelligence', default: true },
  { key: 'branches', label: 'Branches', icon: '🏢', group: 'Administration', default: true },
  { key: 'integrations', label: 'Integrations', icon: '🔌', group: 'Administration', default: false },
  { key: 'notifications', label: 'Notifications', icon: '🔔', group: 'Marketing', default: true },
  { key: 'subscription', label: 'Subscription & License', icon: '🔑', group: 'Administration', default: true },
  { key: 'settings', label: 'Settings', icon: '⚙️', group: 'Administration', default: true },
];

const ALL_KEYS = MODULES.map((m) => m.key);

function isValidModule(key) {
  return ALL_KEYS.includes(key);
}

function defaultEnabledModules() {
  return MODULES.filter((m) => m.default !== false).map((m) => m.key);
}

/**
 * Normalizes a client-supplied module list against the registry.
 */
function sanitizeModules(list) {
  if (!Array.isArray(list)) return null;
  return list.filter((k) => ALL_KEYS.includes(k));
}

module.exports = { MODULES, ALL_KEYS, isValidModule, defaultEnabledModules, sanitizeModules };
