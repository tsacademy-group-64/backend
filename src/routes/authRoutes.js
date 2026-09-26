const router = require('express').Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { registerRules, loginRules } = require('../utils/validators');

router.post('/register', validateBody(registerRules), authController.register);
router.post('/login', validateBody(loginRules), authController.login);
router.get('/me', authenticate, authController.me);

module.exports = router;
