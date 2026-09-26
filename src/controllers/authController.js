const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/response');

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    const result = await authService.register({ name, email, password, role });
    if (!result.ok) {
      return sendError(res, result.message, result.status);
    }
    return sendSuccess(res, result.message, result.data, result.status);
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    if (!result.ok) {
      return sendError(res, result.message, result.status);
    }
    return sendSuccess(res, result.message, result.data, result.status);
  } catch (err) {
    return next(err);
  }
}

// Convenience protected route: returns the authenticated user.
function me(req, res) {
  return sendSuccess(res, 'Authenticated user fetched', { user: req.user });
}

module.exports = { register, login, me };
