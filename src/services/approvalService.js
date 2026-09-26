const { Expense } = require('../models/Expense');

// Every function returns { ok, status, message, data } so the controller can
// map the result straight onto the API response envelope.

async function loadPendingExpense(expenseId) {
  const expense = await Expense.findById(expenseId);
  if (!expense) {
    return { ok: false, status: 404, message: 'Expense not found', data: null };
  }
  if (expense.status !== 'pending') {
    return {
      ok: false,
      status: 409,
      message: `Expense has already been ${expense.status}`,
      data: null,
    };
  }
  return { ok: true, expense };
}

async function approveExpense({ expenseId, manager }) {
  const loaded = await loadPendingExpense(expenseId);
  if (!loaded.ok) return loaded;

  const expense = loaded.expense;
  expense.set({
    status: 'approved',
    reviewedBy: manager.id,
    reviewedAt: new Date(),
    rejectionReason: null,
  });
  await expense.save();

  return { ok: true, status: 200, message: 'Expense approved', data: { expense } };
}

async function rejectExpense({ expenseId, manager, reason }) {
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmedReason) {
    return { ok: false, status: 400, message: 'Rejection reason is required', data: null };
  }

  const loaded = await loadPendingExpense(expenseId);
  if (!loaded.ok) return loaded;

  const expense = loaded.expense;
  expense.set({
    status: 'rejected',
    rejectionReason: trimmedReason,
    reviewedBy: manager.id,
    reviewedAt: new Date(),
  });
  await expense.save();

  return { ok: true, status: 200, message: 'Expense rejected', data: { expense } };
}

module.exports = { approveExpense, rejectExpense };
