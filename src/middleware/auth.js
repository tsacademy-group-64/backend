const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { User } = require('../models/User');
const { sendError } = require('../utils/response');
const { MONGO_ID_REGEX } = require('../utils/rules');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

// Verifies the JWT and attaches { id, role } to req.user.
async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return sendError(res, 'Authentication token missing', 401);
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      const reason = err.name === 'TokenExpiredError' ? 'expired' : 'invalid';
      return sendError(res, `Authentication token ${reason}`, 401);
    }

    // A valid signature is not enough — the payload must carry a usable id,
    // otherwise findById() would throw a CastError (a 400) instead of a 401.
    if (!payload || typeof payload.id !== 'string' || !MONGO_ID_REGEX.test(payload.id)) {
      return sendError(res, 'Authentication token invalid', 401);
    }

    const user = await User.findById(payload.id).lean();
    if (!user) {
      return sendError(res, 'Authentication failed: user no longer exists', 401);
    }

    req.user = { id: String(user._id), role: user.role, name: user.name, email: user.email };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { authenticate, extractToken };
