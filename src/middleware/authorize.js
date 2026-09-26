const { authenticate } = require('./auth');
const { sendError } = require('../utils/response');

// Usage: router.get('/path', authorize('manager'), handler)
// Must run AFTER authenticate so req.user is populated.
function authorize(...allowedRoles) {
  return function authorizeRole(req, res, next) {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }

    if (allowedRoles.length === 0) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      const needed = allowedRoles.join(' or ');
      return sendError(res, `Access denied: ${needed} role required`, 403);
    }

    return next();
  };
}

// Convenience: authenticate + authorize in one middleware chain.
// Usage: router.post('/path', requireRole('manager'), handler)
function requireRole(...allowedRoles) {
  return [authenticate, authorize(...allowedRoles)];
}

const requireAuth = authenticate;
const requireEmployee = authorize('employee');
const requireManager = authorize('manager');

module.exports = { authorize, requireRole, requireAuth, requireEmployee, requireManager };
