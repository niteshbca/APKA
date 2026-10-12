/**
 * Permission catalog + role templates.
 *
 * Granular permissions follow the `<resource>.<action>` convention where the
 * action is one of view/create/edit/delete/approve/print/export/import/manage.
 * New modules append entries here without any database migration because
 * User.permissions is a free-form string array validated against this catalog.
 */
const PERMISSIONS = [
  // Dashboard
  { key: 'dashboard.view', label: 'View dashboard', module: 'dashboard' },

  // Sales & POS
  { key: 'sales.view', label: 'View sales', module: 'sales' },
  { key: 'sales.create', label: 'Create sale / bill', module: 'sales' },
  { key: 'sales.edit', label: 'Edit sale', module: 'sales' },
  { key: 'sales.delete', label: 'Delete / cancel sale', module: 'sales' },
  { key: 'sales.hold', label: 'Hold sale', module: 'sales' },
  { key: 'sales.park', label: 'Park sale', module: 'sales' },
  { key: 'sales.return', label: 'Process returns / refunds', module: 'sales' },
  { key: 'sales.discount', label: 'Apply discounts', module: 'sales' },
  { key: 'sales.print', label: 'Print invoice', module: 'sales' },

  // Products
  { key: 'products.view', label: 'View products', module: 'products' },
  { key: 'products.create', label: 'Create product', module: 'products' },
  { key: 'products.edit', label: 'Edit product', module: 'products' },
  { key: 'products.delete', label: 'Delete product', module: 'products' },
  { key: 'products.import', label: 'Import products', module: 'products' },
  { key: 'products.export', label: 'Export products', module: 'products' },

  // Categories
  { key: 'categories.view', label: 'View categories', module: 'products' },
  { key: 'categories.create', label: 'Create category', module: 'products' },
  { key: 'categories.edit', label: 'Edit category', module: 'products' },
  { key: 'categories.delete', label: 'Delete category', module: 'products' },

  // Master data
  { key: 'master.view', label: 'View master data', module: 'master' },
  { key: 'master.manage', label: 'Manage master data', module: 'master' },
  { key: 'master.import', label: 'Import master data', module: 'master' },
  { key: 'master.export', label: 'Export master data', module: 'master' },

  // Customers / CRM
  { key: 'customers.view', label: 'View customers', module: 'crm' },
  { key: 'customers.create', label: 'Create customer', module: 'crm' },
  { key: 'customers.edit', label: 'Edit customer', module: 'crm' },
  { key: 'customers.delete', label: 'Delete customer', module: 'crm' },

  // Purchases
  { key: 'purchases.view', label: 'View purchases', module: 'purchases' },
  { key: 'purchases.create', label: 'Create purchase', module: 'purchases' },
  { key: 'purchases.edit', label: 'Edit purchase', module: 'purchases' },
  { key: 'purchases.delete', label: 'Delete purchase', module: 'purchases' },

  // Inventory
  { key: 'inventory.view', label: 'View inventory', module: 'inventory' },
  { key: 'inventory.adjust', label: 'Adjust stock', module: 'inventory' },
  { key: 'inventory.transfer', label: 'Transfer stock', module: 'inventory' },
  { key: 'inventory.count', label: 'Stock count', module: 'inventory' },

  // Invoices
  { key: 'invoices.view', label: 'View invoices', module: 'invoices' },
  { key: 'invoices.export', label: 'Export invoices', module: 'invoices' },

  // Labels
  { key: 'labels.view', label: 'View labels', module: 'labels' },
  { key: 'labels.print', label: 'Print labels', module: 'labels' },
  { key: 'labels.template', label: 'Manage label templates', module: 'labels' },
  { key: 'labels.reprint', label: 'Reprint labels', module: 'labels' },
  { key: 'labels.prices', label: 'View prices on labels', module: 'labels' },

  // Reports
  { key: 'reports.view', label: 'View reports', module: 'reports' },
  { key: 'reports.export', label: 'Export reports', module: 'reports' },
  { key: 'reports.financial', label: 'View financial reports', module: 'reports' },

  // Users / Admin
  { key: 'users.view', label: 'View users', module: 'admin' },
  { key: 'users.create', label: 'Create user', module: 'admin' },
  { key: 'users.edit', label: 'Edit user', module: 'admin' },
  { key: 'users.delete', label: 'Delete user', module: 'admin' },
  { key: 'roles.manage', label: 'Manage roles & permissions', module: 'admin' },
  { key: 'audit.view', label: 'View audit logs', module: 'audit' },
  { key: 'backup.view', label: 'View backups', module: 'backup' },
  { key: 'backup.manage', label: 'Backup & restore', module: 'backup' },

  // Branches
  { key: 'branches.view', label: 'View branches', module: 'branches' },
  { key: 'branches.create', label: 'Create branch', module: 'branches' },
  { key: 'branches.edit', label: 'Edit branch', module: 'branches' },
  { key: 'branches.delete', label: 'Delete branch', module: 'branches' },

  // Settings
  { key: 'settings.view', label: 'View settings', module: 'settings' },
  { key: 'settings.edit', label: 'Edit settings', module: 'settings' },

  // Marketing / notifications
  { key: 'marketing.view', label: 'View campaigns', module: 'marketing' },
  { key: 'marketing.send', label: 'Send campaigns', module: 'marketing' },

  // HR & payroll
  { key: 'hr.view', label: 'View staff / HR', module: 'hr' },
  { key: 'hr.manage', label: 'Manage employees', module: 'hr' },
  { key: 'hr.payroll', label: 'Manage salary / payroll', module: 'hr' },
  { key: 'hr.attendance', label: 'Mark attendance', module: 'hr' },

  // Accounts
  { key: 'accounts.view', label: 'View accounts', module: 'accounts' },
  { key: 'accounts.manage', label: 'Manage income & expenses', module: 'accounts' },
  { key: 'accounts.report', label: 'View account reports', module: 'accounts' },

  // Tasks
  { key: 'tasks.view', label: 'View tasks', module: 'tasks' },
  { key: 'tasks.manage', label: 'Create / edit tasks', module: 'tasks' },
  { key: 'tasks.assign', label: 'Assign tasks', module: 'tasks' },

  // Operations
  { key: 'operations.view', label: 'View operations', module: 'operations' },
  { key: 'operations.manage', label: 'Manage operations', module: 'operations' },
  { key: 'workreports.view', label: 'View work reports', module: 'workreports' },

  // AI assistant
  { key: 'ai.view', label: 'Open AI assistant', module: 'ai' },
  { key: 'ai.use', label: 'Ask the AI assistant', module: 'ai' },

  // Integrations
  { key: 'integrations.view', label: 'View integrations', module: 'integrations' },
  { key: 'integrations.manage', label: 'Manage integrations', module: 'integrations' },

  // Subscription & license
  { key: 'license.view', label: 'View subscription', module: 'subscription' },
  { key: 'license.manage', label: 'Manage subscription/license', module: 'subscription' },

  // Platform
  { key: 'platform.tenants', label: 'Manage tenants (platform)', module: 'admin' },
];

const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
const ALL = '*';

const ROLE_TEMPLATES = {
  superadmin: [ALL],
  admin: PERMISSIONS.filter((p) => p.module !== 'subscription' || true).map((p) => p.key),
  manager: [
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.edit', 'sales.hold', 'sales.park', 'sales.return', 'sales.discount', 'sales.print',
    'products.view', 'products.edit', 'products.export',
    'categories.view', 'categories.edit',
    'master.view', 'master.export',
    'customers.view', 'customers.create', 'customers.edit',
    'purchases.view', 'purchases.create', 'purchases.edit',
    'inventory.view', 'inventory.adjust', 'inventory.transfer', 'inventory.count',
    'invoices.view', 'invoices.export',
    'labels.view', 'labels.print', 'labels.template', 'labels.reprint', 'labels.prices',
    'reports.view', 'reports.export',
    'users.view', 'branches.view', 'settings.view', 'marketing.view',
    'hr.view', 'hr.attendance',
    'accounts.view',
    'tasks.view', 'tasks.manage',
    'operations.view',
    'ai.view', 'ai.use',
  ],
  cashier: [
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.hold', 'sales.park', 'sales.print',
    'products.view', 'categories.view',
    'customers.view', 'customers.create',
    'invoices.view',
    'labels.view', 'labels.print',
    'tasks.view',
    'ai.view', 'ai.use',
  ],
};

function isValidPermission(key) {
  return key === ALL || PERMISSION_KEYS.includes(key);
}

function sanitizePermissions(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(isValidPermission);
}

module.exports = {
  PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_TEMPLATES,
  isValidPermission,
  sanitizePermissions,
};
