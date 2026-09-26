const router = require('express').Router();
const approvalController = require('../controllers/approvalController');
const { requireRole } = require('../middleware/authorize');
const { validateBody, validateParams } = require('../middleware/validate');
const { required, minLength, maxLength, mongoId } = require('../utils/rules');

const idParams = validateParams({ id: [required(), mongoId()] });

// PATCH /api/expenses/:id/approve  (manager only)
router.patch(
  '/:id/approve',
  requireRole('manager'),
  idParams,
  approvalController.approve
);

// PATCH /api/expenses/:id/reject   (manager only)
router.patch(
  '/:id/reject',
  requireRole('manager'),
  idParams,
  validateBody({ reason: [required(), minLength(3), maxLength(500)] }),
  approvalController.reject
);

module.exports = router;
