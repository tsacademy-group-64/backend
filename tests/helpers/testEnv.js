// Shared test harness.
//
// Boots the real Express app on an ephemeral 127.0.0.1 port and points
// Mongoose at a dedicated localhost test database (MONGODB_URI with the
// database name swapped for `expense-approval-test`), so tests can never touch
// development data. No extra test dependencies: Node's built-in test runner +
// global fetch.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-only-secret-not-for-production';
}

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../../src/app');

const TEST_DB_NAME = 'expense-approval-test';

let server = null;
let baseUrl = null;
let seq = 0;

// Reuses host/credentials from MONGODB_URI but swaps the database name.
function buildTestUri() {
  const raw =
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense-approval';
  const [base, query = ''] = raw.split('?');
  const trimmed = base.replace(/\/+$/, '');
  const lastSlash = trimmed.lastIndexOf('/');
  const tail = trimmed.slice(lastSlash + 1);
  // `tail` is the database name unless the URI had no path (or the slash was
  // inside credentials, which contain '@').
  const hasDbName = tail.length > 0 && !tail.includes('@');
  const prefix = hasDbName ? trimmed.slice(0, lastSlash) : trimmed;
  return `${prefix}/${TEST_DB_NAME}${query ? `?${query}` : ''}`;
}

async function startTestServer() {
  await mongoose.connect(buildTestUri());
  await mongoose.connection.dropDatabase();
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.on('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  return baseUrl;
}

async function stopTestServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

async function clearDatabase() {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

// Returns { status, body } where body is the parsed JSON envelope.
async function request(method, path, options = {}) {
  const { token, body, raw, query, headers: extraHeaders } = options;
  const url = new URL(baseUrl + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (extraHeaders) Object.assign(headers, extraHeaders);

  let payload;
  if (raw !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = raw;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(url, { method, headers, body: payload });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: response.status, body: parsed };
}

const get = (path, options) => request('GET', path, options);
const post = (path, options) => request('POST', path, options);
const patch = (path, options) => request('PATCH', path, options);
const remove = (path, options) => request('DELETE', path, options);

let emailSeq = 0;
function uniqueEmail(prefix = 'user') {
  emailSeq += 1;
  return `${prefix}${emailSeq}.${Date.now()}@example.test`;
}

// Registers a user and returns { token, user } (user has no password).
async function registerUser({
  role = 'employee',
  name,
  email,
  password = 'password123',
} = {}) {
  const res = await post('/auth/register', {
    body: {
      name: name || `Test ${role}`,
      email: email || uniqueEmail(role),
      password,
      role,
    },
  });
  if (res.status !== 201) {
    throw new Error(
      `registerUser failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  return { token: res.body.data.token, user: res.body.data.user };
}

// Creates an expense and returns the response; callers assert on it.
function createExpense(token, overrides = {}) {
  return post('/expenses', {
    token,
    body: {
      title: 'Team supplies',
      amount: 150,
      category: 'Supplies',
      date: '2026-09-01',
      description: 'Created by the test helper',
      ...overrides,
    },
  });
}

// submittedBy is a bare id on single documents and a populated object on
// list/detail responses — this normalizes both.
function ownerOf(expense) {
  const owner = expense.submittedBy;
  return typeof owner === 'string' ? owner : String(owner._id);
}

// Decodes a JWT payload without verifying it (tests only).
function decodeToken(token) {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

module.exports = {
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
  uniqueEmail,
  ownerOf,
  decodeToken,
};
