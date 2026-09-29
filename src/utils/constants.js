// Shared domain values used by validation and the approval workflow.
const EXPENSE_STATUSES = ['pending', 'approved', 'rejected'];

// Whitelist for ?sortBy=. Maps the public query value to the schema field so
// clients can never inject an arbitrary database field.
const EXPENSE_SORT_FIELDS = {
  date: 'expenseDate',
  amount: 'amount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  status: 'status',
};

const SORT_ORDERS = ['asc', 'desc'];

// Pagination caps so a client cannot request an unbounded dataset.
const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 100;

module.exports = {
  EXPENSE_STATUSES,
  EXPENSE_SORT_FIELDS,
  SORT_ORDERS,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
};
