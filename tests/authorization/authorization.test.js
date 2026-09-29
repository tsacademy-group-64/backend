// Role-based access control: employee vs manager boundaries.
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  startTestServer,
  stopTestServer,
  clearDatabase,
  get,
  post,
  patch,
  remove,
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

test('an unauthenticated request to a protected route returns 401', async () => {
  const res = await get('/expenses');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.data, null);
});

test('an employee can list expenses', async () => {
  const { token } = await registerUser();

  const res = await get('/expenses', { token });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('a manager can list expenses', async () => {
  const { token } = await registerUser({ role: 'manager' });

  const res = await get('/expenses', { token });

  assert.equal(res.status, 200);
});

test('an employee cannot approve an expense (403)', async () => {
  const employee = await registerUser();
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const res = await patch(`/expenses/${expenseId}/approve`, { token: employee.token });

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /manager role required/);
  assert.equal(res.body.data, null);
});

test('an employee cannot reject an expense (403)', async () => {
  const employee = await registerUser();
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const res = await patch(`/expenses/${expenseId}/reject`, {
    token: employee.token,
    body: { rejectionReason: 'I reject my own expense' },
  });

  assert.equal(res.status, 403);
  assert.match(res.body.message, /manager role required/);
});

test('a manager cannot create expenses (403)', async () => {
  const { token } = await registerUser({ role: 'manager' });

  const res = await post('/expenses', {
    token,
    body: { title: 'Mgr spend', amount: 10, category: 'Misc', date: '2026-09-01' },
  });

  assert.equal(res.status, 403);
  assert.match(res.body.message, /employee role required/);
});

test('a manager cannot update an expense (403)', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const res = await patch(`/expenses/${expenseId}`, {
    token: manager.token,
    body: { title: 'Manager edit' },
  });

  assert.equal(res.status, 403);
  assert.match(res.body.message, /employee role required/);
});

test('a manager cannot delete an expense (403)', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const res = await remove(`/expenses/${expenseId}`, { token: manager.token });

  assert.equal(res.status, 403);
  assert.match(res.body.message, /employee role required/);
});

test('a manager can read any single expense', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const res = await get(`/expenses/${expenseId}`, { token: manager.token });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.expense.id, expenseId);
});

test('a manager can approve an expense (positive control)', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const res = await patch(`/expenses/${expenseId}/approve`, { token: manager.token });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.expense.status, 'approved');
});

test('role checks run before parameter validation (employee + bad id stays 403)', async () => {
  const { token } = await registerUser();

  const res = await patch('/expenses/not-an-id/approve', { token });

  assert.equal(res.status, 403);
});
