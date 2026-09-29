const router = require('express').Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Service is healthy',
    data: { status: 'ok', uptime: process.uptime() },
  });
});

router.use('/auth', require('./authRoutes'));
router.use('/expenses', require('./expenseRoutes'));
router.use('/expenses', require('./expenseApprovalRoutes'));

module.exports = router;
