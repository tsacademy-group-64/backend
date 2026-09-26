# Expense Approval API — Backend

Backend for the Expense Approval App: employees submit expenses, managers approve or decline them.

**Stack:** Node.js · Express.js · MongoDB · Mongoose · JWT · bcryptjs

---

## 1. Setup

### Requirements

- Node.js **18+** (tested on Node 22)
- MongoDB running locally (default `mongodb://127.0.0.1:27017`) or any MongoDB connection string

### Installation

```bash
npm install
```

### Environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `PORT` | no | Port the server listens on (default `5000`) | `5000` |
| `NODE_ENV` | no | `development`, `test` or `production` | `development` |
| `MONGODB_URI` | yes | MongoDB connection string | `mongodb://127.0.0.1:27017/expense-approval` |
| `JWT_SECRET` | **yes** | Secret used to sign/verify JWTs — never commit it | long random string |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `1d`) | `1d` |

`.env` is git-ignored. `.env.example` only contains variable names — never put real secrets in it.

The server refuses to start if `JWT_SECRET` is missing.

### Start the server

```bash
npm run dev   # development, auto-restarts on file changes
npm start     # production
```

On success you should see:

```text
MongoDB connected: 127.0.0.1/expense-approval
Server listening on http://localhost:5000
```

### Project structure

```text
src/
├── config/          # env config + MongoDB connection
├── controllers/     # request handlers (thin: validate → call service → respond)
├── middleware/      # auth, authorize, validate, error handling
├── models/          # Mongoose schemas (User, Expense)
├── routes/          # route definitions, mounted under /api
├── services/        # business logic (authService, approvalService)
├── utils/           # response helpers, validation rules, constants
├── app.js           # Express app
└── server.js        # entry point (config check + DB + listen)
```

---

## 2. Response format

Every response uses the same envelope.

**Success**

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

**Error**

```json
{
  "success": false,
  "message": "Something went wrong",
  "data": null
}
```

**Validation error** (`400`) — field details live in `data.errors`:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": {
    "errors": [{ "field": "email", "message": "must be a valid email address" }]
  }
}
```

### Status codes used

| Code | Meaning |
| --- | --- |
| `200` | OK |
| `201` | Created |
| `400` | Validation failed / malformed request |
| `401` | Missing, invalid or expired token; bad credentials |
| `403` | Authenticated but wrong role |
| `404` | Resource not found |
| `409` | Conflict (duplicate email, expense already processed) |
| `500` | Unexpected server error |

---

## 3. Authentication

Passwords are hashed with bcrypt (never stored or returned in plaintext).
A successful login or registration returns a **JWT** valid for `JWT_EXPIRES_IN`.

Send it on every protected request:

```text
Authorization: Bearer <token>
```

### `POST /api/auth/register`

Creates a user and returns the user plus a token.

- **Auth:** none
- **Role:** any (`role` is optional, defaults to `employee`)

**Request body**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `name` | string | yes | 2–60 characters |
| `email` | string | yes | valid email, unique (case-insensitive) |
| `password` | string | yes | 8–72 characters |
| `role` | string | no | `employee` or `manager` (default `employee`) |

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "securePass123",
  "role": "employee"
}
```

**Success — `201`**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "6ab7d6dfe953d78bf3c17877",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "role": "employee",
      "createdAt": "2026-09-26T14:29:51.247Z",
      "updatedAt": "2026-09-26T14:29:51.247Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors**

| Case | Status | Body |
| --- | --- | --- |
| Invalid/missing fields | `400` | `{"success":false,"message":"Validation failed","data":{"errors":[{"field":"password","message":"must be at least 8 characters"}]}}` |
| Email already registered | `409` | `{"success":false,"message":"Email is already registered","data":null}` |

> For the MVP, roles are chosen at registration (register once with `"role": "manager"` to get a manager account).

### `POST /api/auth/login`

- **Auth:** none

**Request body**

| Field | Type | Required |
| --- | --- | --- |
| `email` | string | yes |
| `password` | string | yes |

```json
{
  "email": "ada@example.com",
  "password": "securePass123"
}
```

**Success — `200`**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "6ab7d6dfe953d78bf3c17877",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "role": "employee",
      "createdAt": "2026-09-26T14:29:51.247Z",
      "updatedAt": "2026-09-26T14:29:51.247Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors**

| Case | Status | Body |
| --- | --- | --- |
| Wrong password or unknown email | `401` | `{"success":false,"message":"Invalid email or password","data":null}` |
| Invalid payload | `400` | validation error envelope |

> Unknown email and wrong password return the **same** message, so the API never reveals which accounts exist.

### `GET /api/auth/me`

Returns the currently authenticated user — handy for frontends to resolve the session after a page reload.

- **Auth:** required
- **Role:** any authenticated user
- **Parameters:** none

**Success — `200`**

```json
{
  "success": true,
  "message": "Authenticated user fetched",
  "data": {
    "user": {
      "id": "6ab7d6dfe953d78bf3c17877",
      "role": "employee",
      "name": "Ada Lovelace",
      "email": "ada@example.com"
    }
  }
}
```

**Errors**

| Case | Status | Message |
| --- | --- | --- |
| No `Authorization` header | `401` | `Authentication token missing` |
| Malformed/wrong-signature token | `401` | `Authentication token invalid` |
| Expired token | `401` | `Authentication token expired` |
| User deleted since token issued | `401` | `Authentication failed: user no longer exists` |

---

## 4. Authorization

Two roles exist: **`employee`** and **`manager`**. The JWT carries the role, and the server re-reads the user from the database on every request, so role changes take effect immediately.

Middleware lives in `src/middleware/authorize.js`:

```js
const { requireRole, authorize, requireAuth } = require('../middleware/authorize');

// authenticate + role check in one step
router.post('/things', requireRole('manager'), handler);

// role check only (when authenticate already ran)
router.get('/other', authenticate, authorize('employee'), handler);

// authentication only, any role
router.get('/mine', requireAuth, handler);
```

Rules enforced by the server:

| Situation | Result |
| --- | --- |
| No/invalid/expired token on a protected route | `401` |
| Employee calls a manager-only route | `403` |
| Manager calls an employee-only route | `403` |
| Correct role | request continues |

Error body for both cases:

```json
{ "success": false, "message": "Access denied: manager role required", "data": null }
```

### Endpoint access matrix

| Endpoint | Auth | Role |
| --- | --- | --- |
| `GET /` | no | — |
| `GET /api/health` | no | — |
| `POST /api/auth/register` | no | — |
| `POST /api/auth/login` | no | — |
| `GET /api/auth/me` | **yes** | any |
| `PATCH /api/expenses/:id/approve` | **yes** | **manager** |
| `PATCH /api/expenses/:id/reject` | **yes** | **manager** |

> Expense CRUD endpoints are being built by another teammate and are **not part of this README yet**. They should follow the same pattern: `requireRole('employee')` for submission routes, `requireRole('manager')` for manager-only reads.

---

## 5. Validation

Validation runs on the server for every request — frontend validation is never trusted.

Reusable pieces:

- `src/middleware/validate.js` → `validateBody(rules)`, `validateParams(rules)`
- `src/utils/rules.js` → `required`, `string`, `email`, `minLength`, `maxLength`, `number`, `greaterThan`, `oneOf`, `mongoId`, `date`, `optional`
- `src/utils/validators.js` → rule maps for the auth endpoints
- `src/utils/constants.js` → `EXPENSE_STATUSES = ['pending', 'approved', 'rejected']`

Adding validation to a new endpoint:

```js
const { validateBody, validateParams } = require('../middleware/validate');
const { required, greaterThan, date, mongoId, oneOf } = require('../utils/rules');
const { EXPENSE_STATUSES } = require('../utils/constants');

router.post(
  '/',
  requireRole('employee'),
  validateBody({
    amount: [required(), number(), greaterThan(0)],
    expenseDate: [required(), date()],
    status: [optional(oneOf(EXPENSE_STATUSES))],
  }),
  handler
);

router.patch(
  '/:id',
  validateParams({ id: [required(), mongoId()] }),
  handler
);
```

Failures always return `400` with:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": { "errors": [{ "field": "amount", "message": "must be greater than 0" }] }
}
```

---

## 6. Expense approval workflow

```text
pending ──┬──> approved
          └──> rejected   (reason required)
```

Once an expense leaves `pending`, it cannot be changed again (`409`).

> **Note:** the expense **CRUD** endpoints (create/list/update/delete) belong to another teammate and are not documented here. The `Expense` model already exists in `src/models/Expense.js`; the approval routes below are live and act on those documents.

### `PATCH /api/expenses/:id/approve`

Approves a pending expense.

- **Auth:** required
- **Role:** `manager`
- **Parameters:** `id` — valid MongoDB ObjectId (path)
- **Request body:** none

**Success — `200`**

```json
{
  "success": true,
  "message": "Expense approved",
  "data": {
    "expense": {
      "_id": "6ab7d6ef2c3bcb55b6737108",
      "title": "Client dinner",
      "amount": 80.5,
      "expenseDate": "2026-09-10T00:00:00.000Z",
      "status": "approved",
      "rejectionReason": null,
      "submittedBy": "6ab7d6dfe953d78bf3c17877",
      "reviewedBy": "6ab7d6ede953d78bf3c1787d",
      "reviewedAt": "2026-09-26T14:30:07.185Z",
      "createdAt": "2026-09-26T14:30:07.058Z",
      "updatedAt": "2026-09-26T14:30:07.191Z"
    }
  }
}
```

**Errors**

| Case | Status | Message |
| --- | --- | --- |
| Missing/invalid token | `401` | `Authentication token missing` / `invalid` / `expired` |
| Employee calls it | `403` | `Access denied: manager role required` |
| `id` is not a valid ObjectId | `400` | `Validation failed` (`{"field":"id","message":"must be a valid id"}`) |
| Expense does not exist | `404` | `Expense not found` |
| Already approved or rejected | `409` | `Expense has already been approved` / `... rejected` |

### `PATCH /api/expenses/:id/reject`

Rejects a pending expense. A reason is **mandatory**.

- **Auth:** required
- **Role:** `manager`
- **Parameters:** `id` — valid MongoDB ObjectId (path)

**Request body**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `reason` | string | yes | 3–500 characters, cannot be blank |

```json
{ "reason": "Outside the approved travel budget" }
```

**Success — `200`**

```json
{
  "success": true,
  "message": "Expense rejected",
  "data": {
    "expense": {
      "_id": "6ab7d77029d0ab10bb469bf8",
      "title": "Taxi to airport",
      "amount": 35,
      "expenseDate": "2026-09-12T00:00:00.000Z",
      "status": "rejected",
      "rejectionReason": "Outside the approved travel budget",
      "submittedBy": "6ab7d6dfe953d78bf3c17877",
      "reviewedBy": "6ab7d6ede953d78bf3c1787d",
      "reviewedAt": "2026-09-26T14:32:32.619Z"
    }
  }
}
```

**Errors**

| Case | Status | Message |
| --- | --- | --- |
| `reason` missing, blank or too short/long | `400` | `Validation failed` (`{"field":"reason","message":"is required"}`) |
| Not authenticated | `401` | `Authentication token missing` / `invalid` / `expired` |
| Employee calls it | `403` | `Access denied: manager role required` |
| Invalid `id` | `400` | `Validation failed` |
| Expense does not exist | `404` | `Expense not found` |
| Already processed | `409` | `Expense has already been approved` / `... rejected` |

---

## 7. Utility endpoints

### `GET /api/health`

Liveness check for the server (no database check).

```json
{ "success": true, "message": "Service is healthy", "data": { "status": "ok", "uptime": 2.7 } }
```

### `GET /`

```json
{ "success": true, "message": "Expense Approval API", "data": { "docs": "/README.md" } }
```

Any unknown route returns `404`:

```json
{ "success": false, "message": "Route not found: GET /api/nope", "data": null }
```

---

## 8. Quick cURL tour

```bash
BASE=http://localhost:5000

# register a manager
curl -X POST $BASE/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Mary Manager","email":"mary@example.com","password":"securePass123","role":"manager"}'

# login and keep the token
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"mary@example.com","password":"securePass123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.token')

# who am I
curl $BASE/api/auth/me -H "Authorization: Bearer $TOKEN"

# approve / reject (EXPENSE_ID comes from your expenses collection)
curl -X PATCH $BASE/api/expenses/$EXPENSE_ID/approve -H "Authorization: Bearer $TOKEN"
curl -X PATCH $BASE/api/expenses/$EXPENSE_ID/reject -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"reason":"Over budget"}'
```

---

## 9. Notes for the team

- **Expense CRUD** (`POST/GET/PUT/PATCH/DELETE /api/expenses`): mount your router in `src/routes/index.js`. Only `PATCH /api/expenses/:id/approve` and `PATCH /api/expenses/:id/reject` are taken.
- **Keep the `Expense` model fields** `status`, `rejectionReason`, `reviewedBy`, `reviewedAt` — the approval workflow writes to them. Extra fields are fine.
- **Never return** `password` from any endpoint; the User schema already strips it, and `select: false` keeps it out of queries.
- **Secrets** stay in `.env` only.
- Add business logic in `src/services/`, keep controllers thin, and reuse `validateBody` + `rules` instead of writing new field checks.
