// Backend validation is authoritative: malformed bodies, params and queries
// must produce friendly 400s — never Mongo/Mongoose/stack-trace leaks.
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
  request,
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

test('creating an expense without a title returns field errors', async () => {
  const { token } = await registerUser();

  const res = await post('/expenses', {
    token,
    body: { amount: 100, category: 'Transport', date: '2026-09-01' },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'Validation failed');
  assert.equal(res.body.data.errors.title, 'is required');
});

test('amount must be a number', async () => {
  const { token } = await registerUser();

  const res = await post('/expenses', {
    token,
    body: { title: 'Taxi', amount: 'lots', category: 'Transport', date: '2026-09-01' },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.data.errors.amount, 'must be a number');
});

test('amount must be greater than 0', async () => {
  const { token } = await registerUser();

  for (const amount of [0, -5]) {
    const res = await post('/expenses', {
      token,
      body: { title: 'Taxi', amount, category: 'Transport', date: '2026-09-01' },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.data.errors.amount, 'must be greater than 0');
  }
});

test('an invalid expense date is rejected', async () => {
  const { token } = await registerUser();

  const res = await post('/expenses', {
    token,
    body: { title: 'Taxi', amount: 10, category: 'Transport', date: 'not-a-date' },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.data.errors.expenseDate, 'must be a valid date');
});

test('a missing category is rejected', async () => {
  const { token } = await registerUser();

  const res = await post('/expenses', {
    token,
    body: { title: 'Taxi', amount: 10, date: '2026-09-01' },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.data.errors.category, 'is required');
});

test('an invalid expense id on the route returns 400, not a CastError', async () => {
  const { token } = await registerUser();
  const { token: managerToken } = await registerUser({ role: 'manager' });

  const list = await get('/expenses/not-an-id', { token });
  const update = await patch('/expenses/not-an-id', { token, body: { title: 'x' } });
  const del = await remove('/expenses/not-an-id', { token });
  const approve = await request('PATCH', '/expenses/123/approve', { token: managerToken });

  assert.equal(list.status, 400);
  assert.equal(list.body.data.errors.id, 'must be a valid id');
  assert.equal(update.status, 400);
  assert.equal(del.status, 400);
  assert.equal(approve.status, 400);

  for (const res of [list, update, del, approve]) {
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Validation failed');
    assert.equal(JSON.stringify(res.body).includes('CastError'), false);
    assert.equal(JSON.stringify(res.body).includes('stack'), false);
  }
});

test('rejecting without a rejectionReason returns a field error', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const res = await patch(`/expenses/${expenseId}/reject`, { token: manager.token, body: {} });

  assert.equal(res.status, 400);
  assert.equal(res.body.data.errors.rejectionReason, 'is required');
});

test('a rejectionReason shorter than 3 characters is rejected', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const res = await patch(`/expenses/${expenseId}/reject`, {
    token: manager.token,
    body: { rejectionReason: 'no' },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.data.errors.rejectionReason, /at least 3/);
});

test('an invalid status filter is rejected', async () => {
  const { token } = await registerUser();

  const res = await get('/expenses', { token, query: { status: 'maybe' } });

  assert.equal(res.status, 400);
  assert.match(res.body.data.errors.status, /must be one of/);
});

test('an invalid sortBy field is rejected (no field injection)', async () => {
  const { token } = await registerUser();

  const res = await get('/expenses', { token, query: { sortBy: 'password' } });

  assert.equal(res.status, 400);
  assert.match(res.body.data.errors.sortBy, /must be one of/);
});

test('an invalid sortOrder is rejected', async () => {
  const { token } = await registerUser();

  const res = await get('/expenses', { token, query: { sortOrder: 'sideways' } });

  assert.equal(res.status, 400);
  assert.match(res.body.data.errors.sortOrder, /must be one of/);
});

test('invalid pagination values are rejected', async () => {
  const { token } = await registerUser();

  const zeroPage = await get('/expenses', { token, query: { page: 0 } });
  const negative = await get('/expenses', { token, query: { limit: -3 } });
  const notANumber = await get('/expenses', { token, query: { page: 'abc' } });

  assert.equal(zeroPage.status, 400);
  assert.equal(zeroPage.body.data.errors.page, 'must be greater than 0');
  assert.equal(negative.status, 400);
  assert.equal(negative.body.data.errors.limit, 'must be greater than 0');
  assert.equal(notANumber.status, 400);
  assert.equal(notANumber.body.data.errors.page, 'must be a number');
});

test('invalid date filters are rejected', async () => {
  const { token } = await registerUser();

  const bad = await get('/expenses', { token, query: { fromDate: 'yesterday-ish' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.data.errors.fromDate, 'must be a valid date');

  const badRange = await get('/expenses', {
    token,
    query: { fromDate: '2026-09-30', toDate: '2026-09-01' },
  });
  assert.equal(badRange.status, 400);
  assert.equal(badRange.body.data.errors.fromDate, 'must not be after toDate');
});

test('an empty category filter is ignored rather than matching nothing', async () => {
  const { token } = await registerUser();
  await createExpense(token, { category: 'Transport' });

  const res = await get('/expenses', { token, query: { category: '' } });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.pagination.total, 1);
});

test('malformed JSON in the body returns a friendly 400', async () => {
  const { token } = await registerUser();

  const res = await post('/expenses', { token, raw: '{"title": "broken"' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'Invalid JSON in request body');
  assert.equal(res.body.data, null);
});

test('an unknown route returns the standard 404 envelope', async () => {
  const res = await get('/does-not-exist');

  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Route not found/);
  assert.equal(res.body.data, null);
});
