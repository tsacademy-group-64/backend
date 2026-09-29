// Security guarantees: no password/JWT-secret leakage, no cross-user access,
// no mass assignment, no client-controlled approval state.
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
  decodeToken,
} = require('../helpers/testEnv');
const { User } = require('../../src/models/User');
const { Expense } = require('../../src/models/Expense');

before(async () => {
  await startTestServer();
});

after(async () => {
  await stopTestServer();
});

beforeEach(async () => {
  await clearDatabase();
});

test('passwords are stored hashed, never in plaintext', async () => {
  const email = 'hashcheck@example.test';
  await registerUser({ email, password: 'password123' });

  const stored = await User.findOne({ email }).select('+password').lean();

  assert.ok(stored, 'user must exist');
  assert.notEqual(stored.password, 'password123', 'must not be stored in plaintext');
  assert.match(stored.password, /^\$2[aby]\$/);
});

test('login does not reveal whether an account exists', async () => {
  const email = 'nobody@example.test';

  const unknown = await post('/auth/login', { body: { email, password: 'password123' } });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.message, 'Invalid email or password');

  await registerUser({ email });
  const wrongPassword = await post('/auth/login', { body: { email, password: 'wrong-password' } });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.body.message, unknown.body.message);
});

test('no API response contains a bcrypt hash', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;
  await patch(`/expenses/${expenseId}/approve`, { token: manager.token });

  const responses = [
    created,
    await get('/expenses', { token: employee.token }),
    await get('/expenses', { token: manager.token }),
    await get(`/expenses/${expenseId}`, { token: manager.token }),
    await get('/auth/me', { token: employee.token }),
  ];

  for (const res of responses) {
    const text = JSON.stringify(res.body);
    assert.equal(text.includes('$2a$'), false);
    assert.equal(text.includes('$2b$'), false);
  }
});

test('the JWT payload carries only id and role', async () => {
  const { token, user } = await registerUser({ role: 'manager' });
  const payload = decodeToken(token);

  assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'id', 'role']);
  assert.equal(payload.id, user.id);
  assert.equal(payload.role, 'manager');
  assert.equal(payload.password, undefined);
  assert.equal(payload.email, undefined);
});

test('the JWT secret never appears in a response', async () => {
  const { token } = await registerUser();
  const secret = process.env.JWT_SECRET;

  assert.ok(secret, 'JWT_SECRET must be configured for this check to be meaningful');

  const responses = [
    await get('/auth/me', { token }),
    await get('/expenses', { token }),
    await get('/health'),
  ];

  for (const res of responses) {
    assert.equal(JSON.stringify(res.body).includes(secret), false);
  }
});

test('all protected endpoints reject unauthenticated requests', async () => {
  const created = await createExpense((await registerUser()).token);
  const expenseId = created.body.data.expense.id;

  const cases = [
    [await get('/expenses'), 401],
    [await get(`/expenses/${expenseId}`), 401],
    [await post('/expenses', { body: { title: 'x', amount: 1, category: 'x', date: '2026-09-01' } }), 401],
    [await patch(`/expenses/${expenseId}`, { body: { title: 'x' } }), 401],
    [await remove(`/expenses/${expenseId}`), 401],
    [await patch(`/expenses/${expenseId}/approve`), 401],
    [await patch(`/expenses/${expenseId}/reject`, { body: { rejectionReason: 'x' } }), 401],
    [await get('/auth/me'), 401],
  ];

  for (const [res, status] of cases) {
    assert.equal(res.status, status, `expected 401, got ${res.status}`);
    assert.equal(res.body.success, false);
  }
});

test('role restrictions are enforced on approval endpoints', async () => {
  const employee = await registerUser();
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const approve = await patch(`/expenses/${expenseId}/approve`, { token: employee.token });
  const reject = await patch(`/expenses/${expenseId}/reject`, {
    token: employee.token,
    body: { rejectionReason: 'no' },
  });

  assert.equal(approve.status, 403);
  assert.equal(reject.status, 403);

  const still = await get(`/expenses/${expenseId}`, { token: employee.token });
  assert.equal(still.body.data.expense.status, 'pending');
});

test('users cannot read, update or delete another user\'s expense', async () => {
  const a = await registerUser();
  const b = await registerUser();
  const created = await createExpense(b.token, { title: 'B secret' });
  const expenseId = created.body.data.expense.id;

  const read = await get(`/expenses/${expenseId}`, { token: a.token });
  const update = await patch(`/expenses/${expenseId}`, { token: a.token, body: { title: 'stolen' } });
  const del = await remove(`/expenses/${expenseId}`, { token: a.token });

  assert.equal(read.status, 404);
  assert.equal(update.status, 404);
  assert.equal(del.status, 404);

  const ownerView = await get(`/expenses/${expenseId}`, { token: b.token });
  assert.equal(ownerView.status, 200);
  assert.equal(ownerView.body.data.expense.title, 'B secret');
});

test('the expense list is scoped server-side even with spoofed query params', async () => {
  const a = await registerUser();
  const b = await registerUser();
  await createExpense(a.token, { title: 'A item' });
  await createExpense(b.token, { title: 'B item' });

  const spoofed = await get('/expenses', {
    token: a.token,
    query: { userId: b.user.id, employeeId: b.user.id, ownerId: b.user.id },
  });

  assert.equal(spoofed.status, 200);
  assert.equal(spoofed.body.data.pagination.total, 1);
  assert.equal(spoofed.body.data.expenses[0].title, 'A item');
});

test('clients cannot set approval status through create', async () => {
  const { token } = await registerUser();

  const res = await post('/expenses', {
    token,
    body: {
      title: 'Approved already?',
      amount: 100000,
      category: 'Misc',
      date: '2026-09-01',
      status: 'approved',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.expense.status, 'pending');

  const stored = await Expense.findById(res.body.data.expense.id).lean();
  assert.equal(stored.status, 'pending');
  assert.equal(stored.reviewedBy, null);
});

test('clients cannot set approval status through update', async () => {
  const { token } = await registerUser();
  const created = await createExpense(token);
  const expenseId = created.body.data.expense.id;

  const res = await patch(`/expenses/${expenseId}`, {
    token,
    body: { status: 'approved', rejectionReason: 'self-service' },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.expense.status, 'pending');
  assert.equal(res.body.data.expense.rejectionReason, null);

  const stored = await Expense.findById(expenseId).lean();
  assert.equal(stored.status, 'pending');
  assert.equal(stored.rejectionReason, null);
});

test('registering an unknown role is rejected', async () => {
  const res = await post('/auth/register', {
    body: {
      name: 'Superadmin',
      email: 'superadmin@example.test',
      password: 'password123',
      role: 'superadmin',
    },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.data.errors.role, /must be one of/);
});

test('there is no API path for an employee to escalate their own role', async () => {
  const { token, user } = await registerUser();

  // No profile-update endpoint exists (404 on the standard 404 envelope)...
  const put = await patch('/auth/me', { token, body: { role: 'manager' } });
  assert.equal(put.status, 404);

  // ...and the only place `role` is accepted is registration, validated above.
  const stored = await User.findById(user.id).lean();
  assert.equal(stored.role, 'employee');

  // The role in the JWT is only advisory: authorization uses the role stored
  // on the user document, re-read on every request.
  const me = await get('/auth/me', { token });
  assert.equal(me.body.data.user.role, 'employee');
});
