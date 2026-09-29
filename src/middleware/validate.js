const { sendError } = require('../utils/response');
const { isEmpty } = require('../utils/rules');

// Returns { fieldName: "message" } so frontends can map errors to inputs.
function collectErrors(source, rules) {
  const errors = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    for (const rule of fieldRules) {
      const message = rule(source[field], source);
      if (message) {
        errors[field] = message; // one clear error per field is enough
        break;
      }
    }
  }

  return errors;
}

// Validates req.body against a rule map. Returns 400 on failure.
// Usage: router.post('/things', validateBody({ amount: [required(), greaterThan(0)] }), handler)
function validateBody(rules) {
  return (req, res, next) => {
    const errors = collectErrors(req.body || {}, rules);
    if (Object.keys(errors).length > 0) {
      return sendError(res, 'Validation failed', 400, errors);
    }
    return next();
  };
}

// Validates req.params (route parameters) against a rule map.
// Usage: router.patch('/:id/approve', validateParams({ id: [required(), mongoId()] }), handler)
function validateParams(rules) {
  return (req, res, next) => {
    const errors = collectErrors(req.params || {}, rules);
    if (Object.keys(errors).length > 0) {
      return sendError(res, 'Validation failed', 400, errors);
    }
    return next();
  };
}

// Validates req.query (query string) against a rule map.
// Usage: router.get('/', validateQuery({ status: [optional(oneOf(EXPENSE_STATUSES))] }), handler)
function validateQuery(rules) {
  return (req, res, next) => {
    const errors = collectErrors(req.query || {}, rules);
    if (Object.keys(errors).length > 0) {
      return sendError(res, 'Validation failed', 400, errors);
    }
    return next();
  };
}

// Copies accepted aliases into their canonical body field before validation,
// so clients may send either name but rules and handlers see one name only.
// Usage: normalizeBody({ expenseDate: ['date'], rejectionReason: ['reason'] })
function normalizeBody(aliases) {
  return (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== 'object') return next();

    for (const [canonical, aliasNames] of Object.entries(aliases)) {
      if (!isEmpty(body[canonical])) continue;
      for (const alias of aliasNames) {
        if (!isEmpty(body[alias])) {
          body[canonical] = body[alias];
          break;
        }
      }
    }
    return next();
  };
}

module.exports = { validateBody, validateParams, validateQuery, normalizeBody };
