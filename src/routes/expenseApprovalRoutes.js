const router = require('express').Router();
const approvalController = require('../controllers/approvalController');
const { requireRole } = require('../middleware/authorize');
const { validateBody, validateParams, normalizeBody } = require('../middleware/validate');
const { required, mongoId } = require('../utils/rules');
const { rejectExpenseRules } = require('../utils/validators');

const idParams = validateParams({ id: [required(), mongoId()] });

// PATCH /api/expenses/:id/approve  (manager only)
router.patch(
  '/:id/approve',
  requireRole('manager'),
  idParams,
  approvalController.approve
);

// PATCH /api/expenses/:id/reject   (manager only)
// Accepts `rejectionReason` (documented) or the legacy `reason` alias.
router.patch(
  '/:id/reject',
  requireRole('manager'),
  idParams,
  normalizeBody({ rejectionReason: ['reason'] }),
  validateBody(rejectExpenseRules),
  approvalController.reject
);

module.exports = router;
