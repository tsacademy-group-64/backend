const { sendError } = require('../utils/response');

function collectErrors(source, rules) {
  const errors = [];

  for (const [field, fieldRules] of Object.entries(rules)) {
    for (const rule of fieldRules) {
      const message = rule(source[field], source);
      if (message) {
        errors.push({ field, message });
        break; // one clear error per field is enough
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
    if (errors.length > 0) {
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
    if (errors.length > 0) {
      return sendError(res, 'Validation failed', 400, errors);
    }
    return next();
  };
}

module.exports = { validateBody, validateParams };
