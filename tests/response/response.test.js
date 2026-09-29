// Every response must follow the { success, message, data } envelope with a
// correct HTTP status code.
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  startTestServer,
  stopTestServer,
  clearDatabase,
  request,
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

function assertEnvelope(res) {
  assert.ok(res.body && typeof res.body === 'object', 'body must be JSON');
  assert.deepEqual(Object.keys(res.body).sort(), ['data', 'message', 'success']);
  assert.equal(typeof res.body.success, 'boolean');
  assert.equal(typeof res.body.message, 'string');
  assert.ok('data' in res.body);
}

test('success responses use the envelope with 200/201', async () => {
  const { token } = await registerUser();

  const health = await get('/health');
  const register = await post('/auth/register', {
    body: { name: 'Env User', email: 'env@example.test', password: 'password123' },
  });
  const login = await post('/auth/login', {
    body: { email: 'env@example.test', password: 'password123' },
  });
  const me = await get('/auth/me', { token });
  const created = await createExpense(token);
  const list = await get('/expenses', { token });
  const single = await get(`/expenses/${created.body.data.expense.id}`, { token });
  const updated = await patch(`/expenses/${created.body.data.expense.id}`, {
    token,
    body: { title: 'Renamed' },
  });
  const deleted = await remove(`/expenses/${created.body.data.expense.id}`, { token });

  const cases = [
    [health, 200],
    [register, 201],
    [login, 200],
    [me, 200],
    [created, 201],
    [list, 200],
    [single, 200],
    [updated, 200],
    [deleted, 200],
  ];
  for (const [res, status] of cases) {
    assert.equal(res.status, status);
    assert.equal(res.body.success, true);
    assertEnvelope(res);
  }
});

test('error responses use the envelope with the right status codes', async () => {
  const employee = await registerUser();
  const manager = await registerUser({ role: 'manager' });
  await post('/auth/register', {
    body: { name: 'First User', email: 'dup@example.test', password: 'password123' },
  });
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const cases = [
    // 400
    [await post('/auth/register', { body: { name: '', email: 'bad', password: '' } }), 400],
    // 401
    [await get('/expenses'), 401],
    // 403
    [await patch(`/expenses/${expenseId}/approve`, { token: employee.token }), 403],
    // 404
    [await get('/nope'), 404],
    // 409 duplicate email
    [
      await post('/auth/register', {
        body: { name: 'Again', email: 'dup@example.test', password: 'password123' },
      }),
      409,
    ],
  ];

  for (const [res, status] of cases) {
    assert.equal(res.status, status, `expected ${status}, got ${res.status}`);
    assert.equal(res.body.success, false);
    assertEnvelope(res);
    assert.ok(res.body.message.length > 0);
  }
});

test('401 errors return data: null (no field errors)', async () => {
  const res = await get('/expenses');

  assert.equal(res.status, 401);
  assert.equal(res.body.data, null);
});

test('403 errors return data: null', async () => {
  const { token } = await registerUser();

  const res = await request('PATCH', '/expenses/000000000000000000000000/approve', { token });

  assert.equal(res.status, 403);
  assert.equal(res.body.data, null);
});

test('404 errors return data: null', async () => {
  const { token } = await registerUser();
  const created = await createExpense(token);
  await remove(`/expenses/${created.body.data.expense.id}`, { token });

  const res = await get(`/expenses/${created.body.data.expense.id}`, { token });

  assert.equal(res.status, 404);
  assert.equal(res.body.data, null);
});

test('validation errors return structured field errors under data.errors', async () => {
  const { token } = await registerUser();

  const res = await post('/expenses', { token, body: { amount: -1 } });

  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Validation failed');
  assert.equal(typeof res.body.data.errors, 'object');
  assert.equal(res.body.data.errors.amount, 'must be greater than 0');
  assert.equal(res.body.data.errors.title, 'is required');
});

test('conflicts return 409, not 200', async () => {
  const email = 'conflict@example.test';
  await registerUser({ email });

  const res = await post('/auth/register', {
    body: { name: 'Conflict', email, password: 'password123' },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
});

test('failed operations never return 200', async () => {
  const employee = await registerUser();
  const created = await createExpense(employee.token);
  const expenseId = created.body.data.expense.id;

  const failures = [
    await get('/expenses'), // 401
    await patch(`/expenses/${expenseId}/approve`, { token: employee.token }), // 403
    await get('/expenses/000000000000000000000000', { token: employee.token }), // 404
    await post('/expenses', { token: employee.token, body: { amount: 0 } }), // 400
  ];

  for (const res of failures) {
    assert.ok(res.status >= 400, `expected an error status, got ${res.status}`);
    assert.equal(res.body.success, false);
  }
});

test('error bodies never contain stack traces or driver internals', async () => {
  const { token } = await registerUser();

  const responses = [
    await get('/expenses/not-an-id', { token }),
    await post('/expenses', { token, body: { amount: 'x' } }),
    await get('/does-not-exist'),
    await request('PATCH', '/expenses/000000000000000000000000/approve', { token }),
  ];

  for (const res of responses) {
    const text = JSON.stringify(res.body);
    assert.equal(text.includes('at Object'), false);
    assert.equal(text.includes('node_modules'), false);
    assert.equal(text.includes('stack'), false);
    assert.equal(text.includes('MongoServerError'), false);
    assert.equal(text.includes('ValidationError'), false);
  }
});

test('expense payloads never expose internal mongoose fields', async () => {
  const { token } = await registerUser();
  const created = await createExpense(token);
  const expenseId = created.body.data.expense.id;

  const responses = [
    created,
    await get('/expenses', { token }),
    await get(`/expenses/${expenseId}`, { token }),
    await patch(`/expenses/${expenseId}`, { token, body: { title: 'Still clean' } }),
  ];

  for (const res of responses) {
    assert.equal(JSON.stringify(res.body).includes('"__v"'), false);
  }
});
