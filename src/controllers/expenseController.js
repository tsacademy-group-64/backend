const expenseService = require('../services/expenseService');
const { sendSuccess, sendError } = require('../utils/response');

// Thin layer: pull request data, call the service, map its result onto the
// response envelope. All decisions live in expenseService.
async function create(req, res, next) {
  try {
    const result = await expenseService.createExpense({ body: req.body, user: req.user });
    if (!result.ok) return sendError(res, result.message, result.status);
    return sendSuccess(res, result.message, result.data, result.status);
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await expenseService.listExpenses({ user: req.user, query: req.query });
    if (!result.ok) return sendError(res, result.message, result.status);
    return sendSuccess(res, result.message, result.data, result.status);
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const result = await expenseService.getExpense({ id: req.params.id, user: req.user });
    if (!result.ok) return sendError(res, result.message, result.status);
    return sendSuccess(res, result.message, result.data, result.status);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const result = await expenseService.updateExpense({
      id: req.params.id,
      body: req.body,
      user: req.user,
    });
    if (!result.ok) return sendError(res, result.message, result.status);
    return sendSuccess(res, result.message, result.data, result.status);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await expenseService.deleteExpense({ id: req.params.id, user: req.user });
    if (!result.ok) return sendError(res, result.message, result.status);
    return sendSuccess(res, result.message, result.data, result.status);
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, list, getOne, update, remove };
