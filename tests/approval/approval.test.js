// Manager approval / rejection workflow and status transition rules.
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  startTestServer,
  stopTestServer,
  clearDatabase,
  get,
  patch,
  registerUser,
  createExpense,
} = require('../helpers/testEnv');

before(async () => {
  await startTestServer();
});

after(async () => {
  await stopTestServer();
});

beforeEach(async () => {
  await clearDatabase();
});

async function pendingExpense() {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  const created = await createExpense(employee.token, { title: 'Review me' });
  return { employee, manager, expenseId: created.body.data.expense.id };
}

test('a manager approves a pending expense', async () => {
  const { employee, manager, expenseId } = await pendingExpense();

  const res = await patch(`/expenses/${expenseId}/approve`, { token: manager.token });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Expense approved');
  assert.equal(res.body.data.expense.status, 'approved');
  assert.equal(res.body.data.expense.rejectionReason, null);
  assert.equal(res.body.data.expense.reviewedBy._id, manager.user.id);
  assert.ok(res.body.data.expense.reviewedAt);

  const reread = await get(`/expenses/${expenseId}`, { token: employee.token });
  assert.equal(reread.body.data.expense.status, 'approved');
});

test('a manager rejects a pending expense and the reason is persisted', async () => {
  const { employee, manager, expenseId } = await pendingExpense();
  const reason = 'The expense does not include sufficient supporting details.';

  const res = await patch(`/expenses/${expenseId}/reject`, {
    token: manager.token,
    body: { rejectionReason: reason },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Expense rejected');
  assert.equal(res.body.data.expense.status, 'rejected');
  assert.equal(res.body.data.expense.rejectionReason, reason);
  assert.equal(res.body.data.expense.reviewedBy._id, manager.user.id);

  const reread = await get(`/expenses/${expenseId}`, { token: employee.token });
  assert.equal(reread.body.data.expense.status, 'rejected');
  assert.equal(reread.body.data.expense.rejectionReason, reason);
});

test('the legacy `reason` alias is accepted on reject', async () => {
  const { manager, expenseId } = await pendingExpense();

  const res = await patch(`/expenses/${expenseId}/reject`, {
    token: manager.token,
    body: { reason: 'Missing receipt details' },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.expense.rejectionReason, 'Missing receipt details');
});

test('rejecting without a reason fails with 400', async () => {
  const { manager, expenseId } = await pendingExpense();

  const res = await patch(`/expenses/${expenseId}/reject`, { token: manager.token, body: {} });

  assert.equal(res.status, 400);
  assert.equal(res.body.data.errors.rejectionReason, 'is required');

  const reread = await get(`/expenses/${expenseId}`, { token: manager.token });
  assert.equal(reread.body.data.expense.status, 'pending');
});

test('a whitespace-only rejection reason is rejected', async () => {
  const { manager, expenseId } = await pendingExpense();

  const res = await patch(`/expenses/${expenseId}/reject`, {
    token: manager.token,
    body: { rejectionReason: '   ' },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.data.errors.rejectionReason, 'is required');
});

test('an approved expense cannot be approved again (409)', async () => {
  const { manager, expenseId } = await pendingExpense();
  await patch(`/expenses/${expenseId}/approve`, { token: manager.token });

  const res = await patch(`/expenses/${expenseId}/approve`, { token: manager.token });

  assert.equal(res.status, 409);
  assert.equal(res.body.message, 'Expense has already been approved');
});

test('an approved expense cannot be rejected (409)', async () => {
  const { manager, expenseId } = await pendingExpense();
  await patch(`/expenses/${expenseId}/approve`, { token: manager.token });

  const res = await patch(`/expenses/${expenseId}/reject`, {
    token: manager.token,
    body: { rejectionReason: 'changed my mind' },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.message, 'Expense has already been approved');
});

test('a rejected expense cannot be approved (409)', async () => {
  const { manager, expenseId } = await pendingExpense();
  await patch(`/expenses/${expenseId}/reject`, {
    token: manager.token,
    body: { rejectionReason: 'nope' },
  });

  const res = await patch(`/expenses/${expenseId}/approve`, { token: manager.token });

  assert.equal(res.status, 409);
  assert.equal(res.body.message, 'Expense has already been rejected');
});

test('a rejected expense cannot be rejected again (409)', async () => {
  const { manager, expenseId } = await pendingExpense();
  await patch(`/expenses/${expenseId}/reject`, {
    token: manager.token,
    body: { rejectionReason: 'nope' },
  });

  const res = await patch(`/expenses/${expenseId}/reject`, {
    token: manager.token,
    body: { rejectionReason: 'again' },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.message, 'Expense has already been rejected');
});

test('approving a nonexistent expense returns 404', async () => {
  const { manager } = await pendingExpense();
  const ghostId = new mongoose.Types.ObjectId().toHexString();

  const res = await patch(`/expenses/${ghostId}/approve`, { token: manager.token });

  assert.equal(res.status, 404);
  assert.equal(res.body.message, 'Expense not found');
  assert.equal(res.body.data, null);
});

test('rejecting a nonexistent expense returns 404', async () => {
  const { manager } = await pendingExpense();
  const ghostId = new mongoose.Types.ObjectId().toHexString();

  const res = await patch(`/expenses/${ghostId}/reject`, {
    token: manager.token,
    body: { rejectionReason: 'because it does not exist' },
  });

  assert.equal(res.status, 404);
  assert.equal(res.body.message, 'Expense not found');
});

test('approving with an invalid id returns 400, not a CastError', async () => {
  const { manager } = await pendingExpense();

  const res = await patch('/expenses/definitely-not-an-id/approve', { token: manager.token });

  assert.equal(res.status, 400);
  assert.equal(res.body.data.errors.id, 'must be a valid id');
  assert.equal(JSON.stringify(res.body).includes('CastError'), false);
});

test('rejecting with an invalid id returns 400, not a CastError', async () => {
  const { manager } = await pendingExpense();

  const res = await patch('/expenses/definitely-not-an-id/reject', {
    token: manager.token,
    body: { rejectionReason: 'does not matter' },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.data.errors.id, 'must be a valid id');
});

test('an employee sees the manager\'s decision on their own expense', async () => {
  const { employee, manager, expenseId } = await pendingExpense();

  await patch(`/expenses/${expenseId}/reject`, {
    token: manager.token,
    body: { rejectionReason: 'Please attach the original receipt.' },
  });

  const res = await get(`/expenses/${expenseId}`, { token: employee.token });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.expense.status, 'rejected');
  assert.equal(res.body.data.expense.rejectionReason, 'Please attach the original receipt.');
  assert.equal(res.body.data.expense.reviewedBy.name, manager.user.name);
});

test('approve and reject responses never expose internals', async () => {
  const { manager, expenseId } = await pendingExpense();

  const approved = await patch(`/expenses/${expenseId}/approve`, { token: manager.token });
  const text = JSON.stringify(approved.body);

  assert.equal(text.includes('$2a$'), false);
  assert.equal(text.includes('password'), false);
  assert.equal(text.includes('stack'), false);
  assert.equal(text.includes('secret'), false);
});
