const approvalService = require('../services/approvalService');
const { sendSuccess, sendError } = require('../utils/response');

async function approve(req, res, next) {
  try {
    const result = await approvalService.approveExpense({
      expenseId: req.params.id,
      manager: req.user,
    });
    if (!result.ok) {
      return sendError(res, result.message, result.status);
    }
    return sendSuccess(res, result.message, result.data, result.status);
  } catch (err) {
    return next(err);
  }
}

async function reject(req, res, next) {
  try {
    const result = await approvalService.rejectExpense({
      expenseId: req.params.id,
      manager: req.user,
      reason: req.body.reason,
    });
    if (!result.ok) {
      return sendError(res, result.message, result.status);
    }
    return sendSuccess(res, result.message, result.data, result.status);
  } catch (err) {
    return next(err);
  }
}

module.exports = { approve, reject };
