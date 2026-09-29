const { ROLES } = require('../models/User');
const {
  EXPENSE_STATUSES,
  EXPENSE_SORT_FIELDS,
  SORT_ORDERS,
} = require('./constants');
const {
  required,
  string,
  email,
  minLength,
  maxLength,
  number,
  greaterThan,
  oneOf,
  date,
  optional,
  notAfter,
} = require('./rules');

// Rule maps for the auth endpoints. Consumed by validateBody() in the routes.
const registerRules = {
  name: [required(), string(), minLength(2), maxLength(60)],
  email: [required(), email()],
  password: [required(), minLength(8), maxLength(72)],
  role: [optional(oneOf(ROLES))],
};

const loginRules = {
  email: [required(), email()],
  password: [required()],
};

// status / submittedBy / reviewedBy are deliberately absent: clients can never
// submit them. The service picks only the fields listed here.
const createExpenseRules = {
  title: [required(), string(), maxLength(120)],
  amount: [required(), number(), greaterThan(0)],
  category: [required(), string(), maxLength(60)],
  expenseDate: [required(), date()],
  description: [optional(string(), maxLength(500))],
  receiptDetails: [optional(string(), maxLength(1000))],
};

// Partial update: every field optional, but any value sent must be valid.
const updateExpenseRules = {
  title: [optional(string(), minLength(1), maxLength(120))],
  amount: [optional(number(), greaterThan(0))],
  category: [optional(string(), minLength(1), maxLength(60))],
  expenseDate: [optional(date())],
  description: [optional(string(), maxLength(500))],
  receiptDetails: [optional(string(), maxLength(1000))],
};

// GET /api/expenses query rules. Unknown params are ignored by design;
// anything present must still be valid. `notAfter` rejects inverted ranges
// (fromDate after toDate) on the fromDate field.
const listExpenseRules = {
  status: [optional(oneOf(EXPENSE_STATUSES))],
  category: [optional(string(), maxLength(60))],
  fromDate: [optional(date(), notAfter('toDate'))],
  toDate: [optional(date())],
  sortBy: [optional(oneOf(Object.keys(EXPENSE_SORT_FIELDS)))],
  sortOrder: [optional(oneOf(SORT_ORDERS))],
  page: [optional(number(), greaterThan(0))],
  limit: [optional(number(), greaterThan(0))],
};

const rejectExpenseRules = {
  rejectionReason: [required(), string(), minLength(3), maxLength(500)],
};

module.exports = {
  registerRules,
  loginRules,
  createExpenseRules,
  updateExpenseRules,
  listExpenseRules,
  rejectExpenseRules,
};
