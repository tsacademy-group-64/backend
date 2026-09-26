const { ROLES } = require('../models/User');
const { required, string, email, minLength, maxLength, oneOf, optional } = require('./rules');

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

module.exports = { registerRules, loginRules };
