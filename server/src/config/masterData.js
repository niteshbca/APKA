/**
 * Generic master-data registry.
 *
 * Rather than 25 near-identical collections, the platform stores the long tail
 * of configuration entities as typed `MasterRecord` documents. First-class
 * entities that carry bespoke behaviour (Product, Category, Customer, Supplier,
 * Branch, Warehouse) keep their own models.
 *
 * `domain` groups the records in the UI. `fields` declares the optional
 * type-specific inputs rendered by the generic master form.
 */
const MASTER_TYPES = [
  { key: 'warehouse', label: 'Warehouse', domain: 'Inventory', fields: ['address', 'phone'] },
  { key: 'party', label: 'Party', domain: 'Contacts', fields: ['phone', 'email', 'gstin', 'address'] },
  { key: 'brand', label: 'Brand', domain: 'Catalog', fields: ['description'] },
  { key: 'unit', label: 'Unit', domain: 'Catalog', fields: ['shortName'] },
  { key: 'barcode', label: 'Barcode', domain: 'Catalog', fields: ['productRef', 'symbology'] },
  { key: 'tax', label: 'Tax / GST', domain: 'Finance', fields: ['rate', 'type'] },
  { key: 'payment_mode', label: 'Payment Mode', domain: 'Finance', fields: ['type'] },
  { key: 'bank_account', label: 'Bank / Cash Account', domain: 'Finance', fields: ['accountNumber', 'ifsc', 'branchName', 'openingBalance'] },
  { key: 'expense_category', label: 'Expense Category', domain: 'Finance', fields: ['description'] },
  { key: 'income_category', label: 'Income Category', domain: 'Finance', fields: ['description'] },
  { key: 'department', label: 'Department', domain: 'HR', fields: ['description'] },
  { key: 'designation', label: 'Designation', domain: 'HR', fields: ['level'] },
  { key: 'employee_shift', label: 'Employee Shift', domain: 'HR', fields: ['startTime', 'endTime'] },
  { key: 'leave_type', label: 'Leave Type', domain: 'HR', fields: ['paid'] },
  { key: 'vehicle', label: 'Vehicle', domain: 'Operations', fields: ['number', 'type'] },
  { key: 'driver', label: 'Driver', domain: 'Operations', fields: ['phone', 'licenseNo'] },
  { key: 'station', label: 'Station', domain: 'Operations', fields: ['address'] },
  { key: 'route', label: 'Route', domain: 'Operations', fields: ['distance', 'stations'] },
  { key: 'financial_year', label: 'Financial Year', domain: 'Finance', fields: ['startDate', 'endDate'] },
  { key: 'document_series', label: 'Document Series', domain: 'Finance', fields: ['prefix', 'nextNumber'] },
  { key: 'return_reason', label: 'Return Reason', domain: 'Sales', fields: ['description'] },
  { key: 'discount_reason', label: 'Discount Reason', domain: 'Sales', fields: ['description'] },
  { key: 'status', label: 'Status', domain: 'System', fields: ['color'] },
  { key: 'communication_template', label: 'Communication Template', domain: 'Marketing', fields: ['channel', 'subject', 'body'] },
];

const MASTER_KEYS = MASTER_TYPES.map((t) => t.key);

function isValidMasterType(key) {
  return MASTER_KEYS.includes(key);
}

function masterTypeMeta(key) {
  return MASTER_TYPES.find((t) => t.key === key);
}

module.exports = { MASTER_TYPES, MASTER_KEYS, isValidMasterType, masterTypeMeta };
