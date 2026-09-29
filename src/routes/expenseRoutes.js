const router = require('express').Router();
const expenseController = require('../controllers/expenseController');
const { requireRole, requireAuth } = require('../middleware/authorize');
const { validateBody, validateParams, validateQuery, normalizeBody } = require('../middleware/validate');
const { createExpenseRules, updateExpenseRules, listExpenseRules } = require('../utils/validators');
const { required, mongoId } = require('../utils/rules');

const idParams = validateParams({ id: [required(), mongoId()] });

// Clients may send `date` (canonical in the API docs) or `expenseDate`;
// validation and handlers always see expenseDate.
const expenseAliases = normalizeBody({ expenseDate: ['date'] });

// POST /api/expenses — employees submit their own expenses (always pending).
router.post(
  '/',
  requireRole('employee'),
  expenseAliases,
  validateBody(createExpenseRules),
  expenseController.create
);

// GET /api/expenses — employees see their own, managers see everything.
router.get('/', requireAuth, validateQuery(listExpenseRules), expenseController.list);

// GET /api/expenses/:id — own expense (employee) or any expense (manager).
router.get('/:id', requireAuth, idParams, expenseController.getOne);

// PATCH /api/expenses/:id — employees edit their own pending expenses.
router.patch(
  '/:id',
  requireRole('employee'),
  idParams,
  expenseAliases,
  validateBody(updateExpenseRules),
  expenseController.update
);

// DELETE /api/expenses/:id — employees delete their own pending expenses.
router.delete('/:id', requireRole('employee'), idParams, expenseController.remove);

module.exports = router;
