// GET /api/expenses: data isolation, filtering, date range, sorting,
// pagination and manager visibility.
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  startTestServer,
  stopTestServer,
  clearDatabase,
  get,
  patch,
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

// Creates one expense per entry and returns the created documents.
async function seed(token, entries) {
  const created = [];
  for (const entry of entries) {
    const res = await createExpense(token, entry);
    assert.equal(res.status, 201);
    created.push(res.body.data.expense);
  }
  return created;
}

const titles = (body) => body.data.expenses.map((e) => e.title);

test('Employee A only receives Expense A, Employee B only Expense B', async () => {
  const a = await registerUser();
  const b = await registerUser();

  await seed(a.token, [{ title: 'Expense A', amount: 100, category: 'Transport', date: '2026-09-01' }]);
  await seed(b.token, [{ title: 'Expense B', amount: 200, category: 'Food', date: '2026-09-02' }]);

  const listA = await get('/expenses', { token: a.token });
  const listB = await get('/expenses', { token: b.token });

  assert.deepEqual(titles(listA.body), ['Expense A']);
  assert.deepEqual(titles(listB.body), ['Expense B']);
  assert.ok(listA.body.data.expenses.every((e) => ownerOf(e) === a.user.id));
  assert.ok(listB.body.data.expenses.every((e) => ownerOf(e) === b.user.id));
});

test('CRITICAL: ?status=pending never leaks another employee\'s pending expenses', async () => {
  const a = await registerUser();
  const b = await registerUser();

  await seed(a.token, [
    { title: 'A pending', amount: 10, category: 'Transport', date: '2026-09-01' },
  ]);
  await seed(b.token, [
    { title: 'B pending one', amount: 20, category: 'Food', date: '2026-09-02' },
    { title: 'B pending two', amount: 30, category: 'Food', date: '2026-09-03' },
  ]);

  const res = await get('/expenses', { token: a.token, query: { status: 'pending' } });

  assert.equal(res.status, 200);
  assert.deepEqual(titles(res.body), ['A pending']);
  assert.equal(res.body.data.pagination.total, 1);
  assert.equal(JSON.stringify(res.body).includes('B pending'), false);
});

test('an employee can filter their own expenses by status', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });

  const first = await createExpense(employee.token, { title: 'Will be approved', amount: 10, category: 'Transport', date: '2026-09-01' });
  await createExpense(employee.token, { title: 'Stays pending', amount: 20, category: 'Food', date: '2026-09-02' });
  await patch(`/expenses/${first.body.data.expense.id}/approve`, { token: manager.token });

  const approved = await get('/expenses', { token: employee.token, query: { status: 'approved' } });
  const pending = await get('/expenses', { token: employee.token, query: { status: 'pending' } });

  assert.deepEqual(titles(approved.body), ['Will be approved']);
  assert.deepEqual(titles(pending.body), ['Stays pending']);
});

test('a manager can filter all expenses by status across employees', async () => {
  const a = await registerUser();
  const b = await registerUser();
  const manager = await registerUser({ role: 'manager' });

  await seed(a.token, [{ title: 'A thing', amount: 10, category: 'Transport', date: '2026-09-01' }]);
  await seed(b.token, [{ title: 'B thing', amount: 20, category: 'Food', date: '2026-09-02' }]);

  const res = await get('/expenses', { token: manager.token, query: { status: 'pending' } });

  assert.equal(res.body.data.pagination.total, 2);
  assert.deepEqual(titles(res.body).sort(), ['A thing', 'B thing']);
});

test('a manager sees every expense (no employee ownership scope)', async () => {
  const a = await registerUser();
  const b = await registerUser();
  const manager = await registerUser({ role: 'manager' });

  await seed(a.token, [{ title: 'A thing', amount: 10, category: 'Transport', date: '2026-09-01' }]);
  await seed(b.token, [{ title: 'B thing', amount: 20, category: 'Food', date: '2026-09-02' }]);

  const res = await get('/expenses', { token: manager.token });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.pagination.total, 2);
  assert.deepEqual(titles(res.body).sort(), ['A thing', 'B thing']);
});

test('category filtering matches the full category, case-insensitively', async () => {
  const { token } = await registerUser();
  await seed(token, [
    { title: 'Taxi', amount: 10, category: 'Transport', date: '2026-09-01' },
    { title: 'Lunch', amount: 20, category: 'Food', date: '2026-09-02' },
    { title: 'Bus', amount: 30, category: 'transport', date: '2026-09-03' },
    { title: 'Train', amount: 40, category: 'Transportation', date: '2026-09-04' },
  ]);

  const exact = await get('/expenses', { token, query: { category: 'Transport' } });
  const lower = await get('/expenses', { token, query: { category: 'transport' } });

  // Taxi + Bus match "Transport"; "Transportation" must not.
  assert.deepEqual(titles(exact.body).sort(), ['Bus', 'Taxi']);
  assert.deepEqual(titles(lower.body).sort(), ['Bus', 'Taxi']);
});

test('fromDate/toDate filter on the expense date, inclusive of the whole toDate day', async () => {
  const { token } = await registerUser();
  await seed(token, [
    { title: 'August', amount: 10, category: 'Misc', date: '2026-08-20' },
    { title: 'Early Sept', amount: 20, category: 'Misc', date: '2026-09-05' },
    { title: 'Mid Sept', amount: 30, category: 'Misc', date: '2026-09-15' },
    { title: 'End of Sept', amount: 40, category: 'Misc', date: '2026-09-30' },
    { title: 'October', amount: 50, category: 'Misc', date: '2026-10-01' },
  ]);

  const september = await get('/expenses', {
    token,
    query: { fromDate: '2026-09-01', toDate: '2026-09-30' },
  });

  assert.deepEqual(titles(september.body).sort(), ['Early Sept', 'End of Sept', 'Mid Sept']);

  const fromOnly = await get('/expenses', { token, query: { fromDate: '2026-09-15' } });
  assert.deepEqual(titles(fromOnly.body).sort(), ['End of Sept', 'Mid Sept', 'October']);

  const toOnly = await get('/expenses', { token, query: { toDate: '2026-08-31' } });
  assert.deepEqual(titles(toOnly.body), ['August']);
});

test('combined status + category + date filters work together', async () => {
  const { token } = await registerUser();
  await seed(token, [
    { title: 'Sept transport', amount: 10, category: 'Transport', date: '2026-09-05' },
    { title: 'Sept food', amount: 20, category: 'Food', date: '2026-09-06' },
    { title: 'Aug transport', amount: 30, category: 'Transport', date: '2026-08-05' },
  ]);

  const res = await get('/expenses', {
    token,
    query: {
      status: 'pending',
      category: 'Transport',
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      sortBy: 'amount',
      sortOrder: 'desc',
      page: 1,
      limit: 10,
    },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(titles(res.body), ['Sept transport']);
  assert.equal(res.body.data.pagination.total, 1);
});

test('sorting by amount works ascending and descending', async () => {
  const { token } = await registerUser();
  await seed(token, [
    { title: 'Middle', amount: 500, category: 'Misc', date: '2026-09-01' },
    { title: 'Smallest', amount: 100, category: 'Misc', date: '2026-09-02' },
    { title: 'Largest', amount: 900, category: 'Misc', date: '2026-09-03' },
  ]);

  const asc = await get('/expenses', { token, query: { sortBy: 'amount', sortOrder: 'asc' } });
  const desc = await get('/expenses', { token, query: { sortBy: 'amount', sortOrder: 'desc' } });

  assert.deepEqual(titles(asc.body), ['Smallest', 'Middle', 'Largest']);
  assert.deepEqual(titles(desc.body), ['Largest', 'Middle', 'Smallest']);
});

test('sorting by date works ascending and descending', async () => {
  const { token } = await registerUser();
  await seed(token, [
    { title: 'First', amount: 10, category: 'Misc', date: '2026-07-01' },
    { title: 'Second', amount: 20, category: 'Misc', date: '2026-08-01' },
    { title: 'Third', amount: 30, category: 'Misc', date: '2026-09-01' },
  ]);

  const asc = await get('/expenses', { token, query: { sortBy: 'date', sortOrder: 'asc' } });
  const desc = await get('/expenses', { token, query: { sortBy: 'date', sortOrder: 'desc' } });

  assert.deepEqual(titles(asc.body), ['First', 'Second', 'Third']);
  assert.deepEqual(titles(desc.body), ['Third', 'Second', 'First']);
});

test('the default sort is newest first (createdAt desc)', async () => {
  const { token } = await registerUser();
  await seed(token, [
    { title: 'Oldest', amount: 10, category: 'Misc', date: '2026-09-01' },
    { title: 'Middle', amount: 20, category: 'Misc', date: '2026-09-02' },
    { title: 'Newest', amount: 30, category: 'Misc', date: '2026-09-03' },
  ]);

  const res = await get('/expenses', { token });

  assert.deepEqual(titles(res.body), ['Newest', 'Middle', 'Oldest']);
});

test('sortOrder without sortBy still applies to the default field', async () => {
  const { token } = await registerUser();
  await seed(token, [
    { title: 'Oldest', amount: 10, category: 'Misc', date: '2026-09-01' },
    { title: 'Newest', amount: 20, category: 'Misc', date: '2026-09-02' },
  ]);

  const res = await get('/expenses', { token, query: { sortOrder: 'asc' } });

  assert.deepEqual(titles(res.body), ['Oldest', 'Newest']);
});

test('pagination returns page metadata and slices results', async () => {
  const { token } = await registerUser();
  await seed(token, [
    { title: 'One', amount: 10, category: 'Misc', date: '2026-09-01' },
    { title: 'Two', amount: 20, category: 'Misc', date: '2026-09-02' },
    { title: 'Three', amount: 30, category: 'Misc', date: '2026-09-03' },
    { title: 'Four', amount: 40, category: 'Misc', date: '2026-09-04' },
    { title: 'Five', amount: 50, category: 'Misc', date: '2026-09-05' },
  ]);

  const page1 = await get('/expenses', { token, query: { page: 1, limit: 2, sortBy: 'amount', sortOrder: 'asc' } });
  const page2 = await get('/expenses', { token, query: { page: 2, limit: 2, sortBy: 'amount', sortOrder: 'asc' } });
  const page3 = await get('/expenses', { token, query: { page: 3, limit: 2, sortBy: 'amount', sortOrder: 'asc' } });

  assert.deepEqual(titles(page1.body), ['One', 'Two']);
  assert.deepEqual(titles(page2.body), ['Three', 'Four']);
  assert.deepEqual(titles(page3.body), ['Five']);

  for (const [index, res] of [page1, page2, page3].entries()) {
    assert.equal(res.body.data.pagination.page, index + 1);
    assert.equal(res.body.data.pagination.limit, 2);
    assert.equal(res.body.data.pagination.total, 5);
    assert.equal(res.body.data.pagination.totalPages, 3);
  }

  const beyond = await get('/expenses', { token, query: { page: 99, limit: 2 } });
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.body.data.expenses, []);
  assert.equal(beyond.body.data.pagination.total, 5);
});

test('the limit is clamped to a reasonable maximum', async () => {
  const { token } = await registerUser();
  await seed(token, [
    { title: 'One', amount: 10, category: 'Misc', date: '2026-09-01' },
    { title: 'Two', amount: 20, category: 'Misc', date: '2026-09-02' },
  ]);

  const res = await get('/expenses', { token, query: { limit: 5000 } });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.pagination.limit, 100);
  assert.equal(res.body.data.pagination.total, 2);
});

test('defaults: page 1, limit 10', async () => {
  const { token } = await registerUser();
  await seed(token, [{ title: 'Only', amount: 10, category: 'Misc', date: '2026-09-01' }]);

  const res = await get('/expenses', { token });

  assert.deepEqual(res.body.data.pagination, { page: 1, limit: 10, total: 1, totalPages: 1 });
});
