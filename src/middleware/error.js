const { sendError } = require('../utils/response');

// 404 for unknown routes.
function notFound(req, res) {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

// Central error handler. Keeps a single, consistent error shape.
function errorHandler(err, req, res, _next) {
  // express.json() parse failures arrive as SyntaxError with a raw message —
  // replace it with something a client can act on.
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 'Invalid JSON in request body', 400);
  }
  if (err.type === 'entity.too.large') {
    return sendError(res, 'Request body too large', 413);
  }

  // Mongoose schema validation errors
  if (err.name === 'ValidationError') {
    const errors = {};
    for (const [path, e] of Object.entries(err.errors || {})) {
      errors[path] = e.message;
    }
    return sendError(res, 'Validation failed', 400, errors);
  }

  // Invalid MongoDB ObjectId
  if (err.name === 'CastError') {
    return sendError(res, `Invalid value for ${err.path}`, 400);
  }

  // Duplicate unique index (e.g. email already registered)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, `${field} is already in use`, 409);
  }

  const status = err.statusCode || err.status || 500;
  const message = status < 500 ? err.message : 'Something went wrong';
  if (status >= 500) console.error(err);
  return sendError(res, message, status);
}

module.exports = { notFound, errorHandler };
