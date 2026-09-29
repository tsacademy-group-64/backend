// Registration, login, JWT issuance and token rejection behaviour.
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const {
  startTestServer,
  stopTestServer,
  clearDatabase,
  request,
  post,
  get,
  registerUser,
  uniqueEmail,
  decodeToken,
} = require('../helpers/testEnv');
const { config } = require('../../src/config');
const { User } = require('../../src/models/User');

before(async () => {
  await startTestServer();
});

after(async () => {
  await stopTestServer();
});

beforeEach(async () => {
  await clearDatabase();
});

test('POST /api/auth/register creates an employee and returns a JWT', async () => {
  const email = uniqueEmail('ada');
  const res = await post('/auth/register', {
    body: { name: 'Ada Lovelace', email, password: 'password123' },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Registration successful');
  assert.equal(res.body.data.user.role, 'employee');
  assert.equal(res.body.data.user.email, email);
  assert.equal(res.body.data.user.password, undefined);
  assert.equal(typeof res.body.data.token, 'string');

  const payload = decodeToken(res.body.data.token);
  assert.equal(payload.id, res.body.data.user.id);
  assert.equal(payload.role, 'employee');
});

test('POST /api/auth/register accepts the manager role', async () => {
  const res = await post('/auth/register', {
    body: {
      name: 'Meg Manager',
      email: uniqueEmail('mgr'),
      password: 'password123',
      role: 'manager',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.role, 'manager');
});

test('registering a role outside employee/manager is rejected', async () => {
  const res = await post('/auth/register', {
    body: {
      name: 'Admin Attempt',
      email: uniqueEmail('admin'),
      password: 'password123',
      role: 'admin',
    },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.data.errors.role, /must be one of/);
});

test('register rejects a duplicate email with 409', async () => {
  const email = uniqueEmail('dup');
  await registerUser({ email, password: 'password123' });

  const res = await post('/auth/register', {
    body: { name: 'Dup User', email, password: 'password123' },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'Email is already registered');
});

test('register rejects an invalid email', async () => {
  const res = await post('/auth/register', {
    body: { name: 'No Mail', email: 'not-an-email', password: 'password123' },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Validation failed');
  assert.match(res.body.data.errors.email, /valid email/);
});

test('register rejects missing required fields', async () => {
  const res = await post('/auth/register', { body: {} });

  assert.equal(res.status, 400);
  assert.ok(res.body.data.errors.name);
  assert.ok(res.body.data.errors.email);
  assert.ok(res.body.data.errors.password);
});

test('register rejects a password shorter than 8 characters', async () => {
  const res = await post('/auth/register', {
    body: { name: 'Short Pw', email: uniqueEmail('sp'), password: 'short' },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.data.errors.password, /at least 8/);
});

test('register normalizes the email to lowercase', async () => {
  const res = await post('/auth/register', {
    body: {
      name: 'Case User',
      email: 'MixedCase@EXAMPLE.com',
      password: 'password123',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.email, 'mixedcase@example.com');

  const stored = await User.findOne({ email: 'mixedcase@example.com' }).lean();
  assert.ok(stored);
});

test('no response ever contains a password or bcrypt hash', async () => {
  const email = uniqueEmail('safe');
  const register = await post('/auth/register', {
    body: { name: 'Safe User', email, password: 'password123' },
  });
  const login = await post('/auth/login', {
    body: { email, password: 'password123' },
  });
  const me = await get('/auth/me', { token: register.body.data.token });

  for (const res of [register, login, me]) {
    const text = JSON.stringify(res.body);
    assert.equal(text.includes('password'), false);
    assert.equal(text.includes('$2a$'), false);
    assert.equal(text.includes('$2b$'), false);
  }
});

test('POST /api/auth/login returns a token for valid credentials', async () => {
  const email = uniqueEmail('login');
  await registerUser({ email });

  const res = await post('/auth/login', { body: { email, password: 'password123' } });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Login successful');
  assert.equal(res.body.data.user.email, email);
  assert.equal(res.body.data.user.password, undefined);
  assert.equal(typeof res.body.data.token, 'string');

  const payload = decodeToken(res.body.data.token);
  assert.equal(payload.id, res.body.data.user.id);
  assert.equal(payload.role, 'employee');
});

test('login with the wrong password returns 401', async () => {
  const email = uniqueEmail('badpw');
  await registerUser({ email });

  const res = await post('/auth/login', { body: { email, password: 'wrong-password' } });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'Invalid email or password');
  assert.equal(res.body.data, null);
});

test('login for an unknown email returns 401 with the same message', async () => {
  const res = await post('/auth/login', {
    body: { email: uniqueEmail('ghost'), password: 'password123' },
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Invalid email or password');
});

test('login rejects missing credentials', async () => {
  const res = await post('/auth/login', { body: {} });

  assert.equal(res.status, 400);
  assert.ok(res.body.data.errors.email);
  assert.ok(res.body.data.errors.password);
});

test('GET /api/auth/me returns the authenticated user', async () => {
  const { token, user } = await registerUser({ name: 'Me User' });

  const res = await get('/auth/me', { token });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.id, user.id);
  assert.equal(res.body.data.user.name, 'Me User');
  assert.equal(res.body.data.user.password, undefined);
});

test('GET /api/auth/me without a token returns 401', async () => {
  const res = await get('/auth/me');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.data, null);
});

test('a missing Authorization header is rejected with 401', async () => {
  const res = await get('/expenses');

  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Authentication token missing');
  assert.equal(res.body.data, null);
});

test('a non-Bearer Authorization header is rejected with 401', async () => {
  const { token } = await registerUser();
  const res = await request('GET', '/expenses', {
    headers: { Authorization: `Basic ${token}` },
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Authentication token missing');
});

test('a malformed token is rejected with 401', async () => {
  const res = await get('/expenses', { token: 'abc.def.ghi' });

  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Authentication token invalid');
  assert.equal(res.body.data, null);
});

test('a token signed with a different secret is rejected with 401', async () => {
  const { user } = await registerUser();
  const forged = jwt.sign({ id: user.id, role: 'employee' }, 'not-the-real-secret');

  const res = await get('/expenses', { token: forged });

  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Authentication token invalid');
});

test('an expired token is rejected with 401', async () => {
  const { user } = await registerUser();
  const expired = jwt.sign(
    { id: user.id, role: 'employee' },
    config.jwt.secret,
    { expiresIn: '-10s' }
  );

  const res = await get('/expenses', { token: expired });

  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Authentication token expired');
  assert.equal(res.body.data, null);
});

test('a token whose user no longer exists is rejected with 401', async () => {
  const { token, user } = await registerUser();
  await User.deleteOne({ _id: new mongoose.Types.ObjectId(user.id) });

  const res = await get('/expenses', { token });

  assert.equal(res.status, 401);
  assert.match(res.body.message, /user no longer exists/);
});

test('a token with a structurally invalid payload is rejected with 401', async () => {
  const forged = jwt.sign({ sub: 'no-id-here' }, config.jwt.secret);

  const res = await get('/expenses', { token: forged });

  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Authentication token invalid');
});
