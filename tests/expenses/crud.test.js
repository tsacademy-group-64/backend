// Expense CRUD: creation rules, ownership isolation, updates and deletes.
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

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
  ownerOf,
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

test('an employee creates an expense that defaults to pending', async () => {
  const { token, user } = await registerUser();

  const res = await post('/expenses', {
    token,
    body: {
      title: 'Transportation',
      amount: 5000,
      category: 'Transport',
      date: '2026-09-29',
      description: 'Transportation for school activity',
      receiptDetails: 'Taxi receipt',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Expense created successfully');
  assert.equal(res.body.data.expense.status, 'pending');
  assert.equal(res.body.data.expense.title, 'Transportation');
  assert.equal(res.body.data.expense.amount, 5000);
  assert.equal(res.body.data.expense.rejectionReason, null);
  assert.equal(res.body.data.expense.submittedBy, user.id);
});

test('the owner comes from the JWT, never from the request body', async () => {
  const owner = await registerUser();
  const other = await registerUser();
  const created = await createExpense(owner.token);

  const res = await post('/expenses', {
    token: owner.token,
    body: {
      title: 'Spoofed owner',
      amount: 10,
      category: 'Misc',
      date: '2026-09-01',
      submittedBy: other.user.id,
      employeeId: other.user.id,
      userId: other.user.id,
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.expense.submittedBy, owner.user.id);
  assert.equal(ownerOf(created.body.data.expense), owner.user.id);
});

test('a client cannot create an already-approved expense', async () => {
  const { token, user } = await registerUser();

  const res = await post('/expenses', {
    token,
    body: {
      title: 'Sneaky',
      amount: 9999,
      category: 'Misc',
      date: '2026-09-01',
      status: 'approved',
      rejectionReason: 'pre-filled',
      reviewedBy: user.id,
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.expense.status, 'pending');
  assert.equal(res.body.data.expense.rejectionReason, null);
  assert.equal(res.body.data.expense.reviewedBy, null);
});

test('the `date` alias maps onto expenseDate', async () => {
  const { token } = await registerUser();

  const res = await post('/expenses', {
    token,
    body: { title: 'Alias', amount: 10, category: 'Misc', date: '2026-09-29' },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.expense.expenseDate, '2026-09-29T00:00:00.000Z');
});

test('an employee only ever sees their own expenses in the list', async () => {
  const a = await registerUser();
  const b = await registerUser();

  const expenseA = await createExpense(a.token, { title: 'A expense' });
  const expenseB = await createExpense(b.token, { title: 'B expense' });

  const listA = await get('/expenses', { token: a.token });
  const listB = await get('/expenses', { token: b.token });

  assert.equal(listA.status, 200);
  assert.equal(listA.body.data.pagination.total, 1);
  assert.equal(listA.body.data.expenses[0].title, 'A expense');
  assert.equal(ownerOf(listA.body.data.expenses[0]), a.user.id);

  assert.equal(listB.body.data.pagination.total, 1);
  assert.equal(listB.body.data.expenses[0].title, 'B expense');
  assert.equal(ownerOf(listB.body.data.expenses[0]), b.user.id);

  assert.notEqual(expenseA.body.data.expense.id, expenseB.body.data.expense.id);
});

test('an employee can fetch their own expense', async () => {
  const { token, user } = await registerUser();
  const created = await createExpense(token, { title: 'My own' });

  const res = await get(`/expenses/${created.body.data.expense.id}`, { token });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Expense fetched successfully');
  assert.equal(res.body.data.expense.title, 'My own');
  assert.equal(res.body.data.expense.submittedBy._id, user.id);
});

test('an employee cannot fetch another employee\'s expense', async () => {
  const a = await registerUser();
  const b = await registerUser();
  const created = await createExpense(b.token, { title: 'B private' });

  const res = await get(`/expenses/${created.body.data.expense.id}`, { token: a.token });

  // 404 (not 403) so the API never confirms that a foreign expense exists.
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'Expense not found');
  assert.equal(res.body.data, null);
  assert.equal(JSON.stringify(res.body).includes('B private'), false);
});

test('fetching a nonexistent expense returns 404', async () => {
  const { token } = await registerUser();
  const ghostId = new mongoose.Types.ObjectId().toHexString();

  const res = await get(`/expenses/${ghostId}`, { token });

  assert.equal(res.status, 404);
  assert.equal(res.body.message, 'Expense not found');
});

test('an employee can update their own pending expense', async () => {
  const { token } = await registerUser();
  const created = await createExpense(token);
  const expenseId = created.body.data.expense.id;

  const res = await patch(`/expenses/${expenseId}`, {
    token,
    body: { title: 'Updated title', amount: 750, description: 'Updated description' },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Expense updated successfully');
  assert.equal(res.body.data.expense.title, 'Updated title');
  assert.equal(res.body.data.expense.amount, 750);
  assert.equal(res.body.data.expense.description, 'Updated description');
  assert.equal(res.body.data.expense.status, 'pending');

  const reread = await get(`/expenses/${expenseId}`, { token });
  assert.equal(reread.body.data.expense.title, 'Updated title');
});

test('an employee cannot update another employee\'s expense', async () => {
  const a = await registerUser();
  const b = await registerUser();
  const created = await createExpense(b.token, { title: 'B original' });

  const res = await patch(`/expenses/${created.body.data.expense.id}`, {
    token: a.token,
    body: { title: 'Hijacked' },
  });

  assert.equal(res.status, 404);
  assert.equal(res.body.message, 'Expense not found');

  const reread = await get(`/expenses/${created.body.data.expense.id}`, { token: b.token });
  assert.equal(reread.body.data.expense.title, 'B original');
});

test('protected fields cannot be changed through the update endpoint', async () => {
  const { token, user } = await registerUser();
  const created = await createExpense(token);
  const expenseId = created.body.data.expense.id;

  const res = await patch(`/expenses/${expenseId}`, {
    token,
    body: {
      status: 'approved',
      submittedBy: user.id,
      reviewedBy: user.id,
      reviewedAt: '2026-09-29T00:00:00.000Z',
      rejectionReason: 'self-approved nonsense',
      _id: '000000000000000000000000',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.expense.status, 'pending');
  assert.equal(res.body.data.expense.rejectionReason, null);
  assert.equal(res.body.data.expense.reviewedBy, null);
  assert.equal(res.body.data.expense.reviewedAt, null);

  const reread = await get(`/expenses/${expenseId}`, { token });
  assert.equal(reread.body.data.expense.status, 'pending');
  assert.equal(reread.body.data.expense._id, expenseId);
});

test('a finalized expense cannot be updated (409)', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  await patch(`/expenses/${expenseId}/approve`, { token: manager.token });

  const res = await patch(`/expenses/${expenseId}`, {
    token: employee.token,
    body: { title: 'Too late' },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.message, 'Expense has already been approved');
});

test('an employee can delete their own pending expense', async () => {
  const { token } = await registerUser();
  const created = await createExpense(token);
  const expenseId = created.body.data.expense.id;

  const res = await remove(`/expenses/${expenseId}`, { token });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Expense deleted successfully');
  assert.equal(res.body.data, null);

  const reread = await get(`/expenses/${expenseId}`, { token });
  assert.equal(reread.status, 404);
});

test('an employee cannot delete another employee\'s expense', async () => {
  const a = await registerUser();
  const b = await registerUser();
  const created = await createExpense(b.token);

  const res = await remove(`/expenses/${created.body.data.expense.id}`, { token: a.token });

  assert.equal(res.status, 404);

  const reread = await get(`/expenses/${created.body.data.expense.id}`, { token: b.token });
  assert.equal(reread.status, 200);
});

test('a finalized expense cannot be deleted (409)', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  await patch(`/expenses/${expenseId}/approve`, { token: manager.token });

  const res = await remove(`/expenses/${expenseId}`, { token: employee.token });

  assert.equal(res.status, 409);
  assert.equal(res.body.message, 'Expense has already been approved');

  const reread = await get(`/expenses/${expenseId}`, { token: employee.token });
  assert.equal(reread.status, 200);
});
