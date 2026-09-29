# Expense Approval API — Backend

Backend for the **Expense Approval App**: employees submit expenses, managers review them and decide.

This README is written for **frontend developers**. You should be able to integrate the API end to end without reading a single backend source file.

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Tech stack](#2-tech-stack)
3. [Folder structure](#3-folder-structure)
4. [Installation](#4-installation)
5. [Environment setup](#5-environment-setup)
6. [Running the server](#6-running-the-server)
7. [Authentication flow](#7-authentication-flow)
8. [Roles](#8-roles)
9. [API endpoint reference](#9-api-endpoint-reference)
10. [Authentication examples](#10-authentication-examples)
11. [Expense examples](#11-expense-examples)
12. [Expense status behavior](#12-expense-status-behavior)
13. [Error handling](#13-error-handling)
14. [Frontend Integration Guide](#14-frontend-integration-guide)
15. [Example frontend API service layer](#15-example-frontend-api-service-layer)
16. [Complete endpoint matrix](#16-complete-endpoint-matrix)

---

## 1. Project overview

The Expense Approval App is a small expense-reporting workflow with two kinds of users:

- **Employee** — submits expenses (transport, supplies, meals, …) and tracks their own reports.
- **Manager** — reviews submitted expenses and approves or rejects them.

### Expense lifecycle

```text
Employee creates expense
        ↓
     pending  ──────────────┐
        ↓                  ↓
   manager approves    manager rejects (reason required)
        ↓                  ↓
    approved            rejected
        └────── final ──────┘
```

- A new expense is **always** created as `pending`. The client cannot choose otherwise.
- A manager moves it to `approved` **or** `rejected`. Rejection stores a `rejectionReason`.
- Once an expense is `approved` or `rejected` it is **final**: it can no longer be edited, deleted, approved or rejected again (the API answers `409 Conflict`).
- Employees only ever see **their own** expenses. Managers see every expense so they can review them.

Everything below follows from that lifecycle.

---

## 2. Tech stack

| Technology | Used for |
| --- | --- |
| **Node.js 18+** (tested on Node 22) | runtime |
| **Express 4** | HTTP server and routing |
| **MongoDB** | database |
| **Mongoose 8** | schemas, validation, queries |
| **JSON Web Tokens (`jsonwebtoken`)** | stateless authentication |
| **bcryptjs** | password hashing |
| **dotenv** | loading `.env` |
| **Node built-in test runner (`node --test`)** | automated tests (no extra test framework) |

No other runtime dependencies are used.

---

## 3. Folder structure

```text
backend/
├── src/
│   ├── config/
│   │   ├── index.js          # loads .env, exposes config, checks JWT_SECRET
│   │   └── db.js             # MongoDB connect / disconnect
│   ├── controllers/          # thin: read request → call service → send response
│   │   ├── authController.js
│   │   ├── approvalController.js
│   │   └── expenseController.js
│   ├── middleware/
│   │   ├── auth.js           # authenticate: verifies the JWT, sets req.user
│   │   ├── authorize.js      # authorize(...roles) / requireRole(...roles)
│   │   ├── validate.js       # validateBody / validateParams / validateQuery
│   │   └── error.js          # 404 handler + centralized error handler
│   ├── models/
│   │   ├── User.js           # name, email, password (hashed), role
│   │   └── Expense.js        # amount, category, status, rejectionReason, …
│   ├── routes/
│   │   ├── index.js          # mounts /api/auth, /api/expenses, /api/health
│   │   ├── authRoutes.js
│   │   ├── expenseRoutes.js
│   │   └── expenseApprovalRoutes.js
│   ├── services/             # business logic + database access
│   │   ├── authService.js
│   │   ├── approvalService.js
│   │   └── expenseService.js
│   ├── utils/
│   │   ├── response.js       # sendSuccess / sendError envelope helpers
│   │   ├── rules.js          # reusable validation rules
│   │   ├── validators.js     # per-endpoint rule maps
│   │   └── constants.js      # statuses, sort whitelist, pagination caps
│   ├── app.js                # the Express app (imported by tests)
│   └── server.js             # entry point: config check → DB → listen
├── tests/                    # automated API tests (run with `npm test`)
│   ├── helpers/testEnv.js    # boots the app on a port + test database
│   ├── auth/                 # registration, login, token behaviour
│   ├── authorization/        # 401 / 403 role rules
│   ├── validation/           # 400 field errors, bad ids, bad queries
│   ├── expenses/             # CRUD, ownership isolation, listing/filters
│   ├── approval/             # approve/reject state transitions
│   ├── response/             # envelope + status-code consistency
│   └── security/             # hashing, mass-assignment, cross-user access
├── .env                      # your secrets (git-ignored, never committed)
├── .env.example              # placeholders only
├── package.json
└── README.md
```

**Rule of thumb:** routes declare *who* may call, validation checks *what* was sent, services decide *what happens*, controllers only move data in and out.

---

## 4. Installation

```bash
git clone https://github.com/tsacademy-group-64/backend.git
cd backend
npm install
```

Requirements: **Node.js 18+** and a running **MongoDB** (local install or any connection string).

---

## 5. Environment setup

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

`.env.example` contains **placeholders only**. `.env` is git-ignored and must never be committed.

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `PORT` | no | Port to listen on (default `5000`) | `5000` |
| `NODE_ENV` | no | `development`, `test` or `production` | `development` |
| `MONGODB_URI` | no* | MongoDB connection string | `mongodb://127.0.0.1:27017/expense-approval` |
| `JWT_SECRET` | **yes** | Secret that signs/verify JWTs | long random string |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `1d`) | `1d`, `12h`, `7d` |

\* Falls back to `mongodb://127.0.0.1:27017/expense-approval` if unset.

The server **refuses to start** when `JWT_SECRET` is missing:

```text
Failed to start server: JWT_SECRET is missing. Copy .env.example to .env and set it.
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 6. Running the server

```bash
npm run dev    # development — auto-restarts on file changes
npm start      # production
```

Expected output:

```text
MongoDB connected: 127.0.0.1/expense-approval
Server listening on http://localhost:5000
```

Quick sanity checks:

```bash
curl http://localhost:5000/api/health
# {"success":true,"message":"Service is healthy","data":{"status":"ok","uptime":2.7}}
```

### Running the tests

```bash
npm test
```

- Uses Node's built-in test runner (`node --test`), no extra dependencies.
- Tests talk to **your local MongoDB** on the dedicated database `expense-approval-test`
  (derived from `MONGODB_URI`; it is dropped before/after the run).
  Your development data in `expense-approval` is **never** touched.
- **117 tests** cover authentication, authorization, validation, expense CRUD,
  ownership isolation, filtering/sorting/pagination, approval state transitions,
  response shape and security rules.
- Expected result: `# pass 117` / `# fail 0`.

---

## 7. Authentication flow

```text
1. POST /api/auth/register     → creates the account, returns a token
2. POST /api/auth/login        → returns { user, token }
3. Store the token (localStorage or memory — your choice)
4. Send it on every protected request:

   Authorization: Bearer <JWT>

5. GET /api/auth/me            → re-resolve the session after a page reload
6. On 401 → clear the stored token and redirect to login
```

- The JWT payload contains **only** `id`, `role`, `iat`, `exp`. No email, no password, no secret material.
- The server re-reads the user from the database on every request, so the **database** role is authoritative (a tampered/stale role in the token cannot grant access).
- Tokens expire after `JWT_EXPIRES_IN` (default 1 day). An expired token returns `401` with `"Authentication token expired"`.

---

## 8. Roles

| Role | Can do | Cannot do |
| --- | --- | --- |
| **`employee`** | create expenses; list/view/update/delete **their own** pending expenses; view their own expenses after review | approve/reject anything; see or touch another employee's expenses; call manager routes |
| **`manager`** | list/view **all** expenses; approve pending expenses; reject pending expenses (with a reason) | create/edit/delete expenses (those routes are employee-only → `403`); change a finalized expense |

Guarantees enforced **server-side** (never rely on the frontend for these):

- Identity always comes from the JWT — `userId` / `employeeId` in a request body or query is ignored.
- An employee's `GET /api/expenses` is filtered by their own id inside the database query.
- Reaching another employee's expense by id returns `404` (never `403`), so the API does not confirm that foreign expenses exist.
- `status`, `submittedBy`, `reviewedBy`, `reviewedAt`, `rejectionReason` are **not writable** by clients on create or update.

> **MVP note:** `role` is chosen at registration (`"role": "manager"` creates a manager). There is no admin panel.

---

## 9. API endpoint reference

Base URL used in all examples: `http://localhost:5000/api`

### Response envelope

Every endpoint — success or failure — answers with the same three keys:

```json
{ "success": true, "message": "Human-readable message", "data": {} }
```

```json
{ "success": false, "message": "Human-readable error", "data": null }
```

Validation failures put field messages in `data.errors` as an **object keyed by field**:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": {
    "errors": {
      "amount": "must be greater than 0",
      "title": "is required"
    }
  }
}
```

### Status codes

| Code | Meaning |
| --- | --- |
| `200` | OK |
| `201` | Resource created |
| `400` | Validation failed, malformed JSON, invalid id |
| `401` | Missing / invalid / expired token, bad credentials |
| `403` | Authenticated but wrong role |
| `404` | Not found (or not yours) |
| `409` | Conflict: duplicate email, expense already finalized |
| `413` | Request body too large (limit 1 MB) |
| `500` | Unexpected server error (`"Something went wrong"`) |

---

### `GET /` and `GET /api/health`

Unauthenticated liveness checks.

| | |
| --- | --- |
| **Auth** | none |
| **Body** | none |

```json
{ "success": true, "message": "Service is healthy", "data": { "status": "ok", "uptime": 2.7 } }
```

---

### `POST /api/auth/register`

Creates a user account and returns the user plus a JWT.

| | |
| --- | --- |
| **Auth** | none |
| **Role** | — (the `role` field in the body chooses the role) |
| **Body** | see below |

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `name` | string | yes | 2–60 characters |
| `email` | string | yes | valid email; unique; stored lowercase |
| `password` | string | yes | 8–72 characters (hashed with bcrypt, never stored/returned in plaintext) |
| `role` | string | no | `employee` or `manager`, default `employee` |

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

| Case | Status | Message / body |
| --- | --- | --- |
| Missing/invalid fields | `400` | `Validation failed` with `data.errors` per field (e.g. `password: "must be at least 8 characters"`, `role: "must be one of: employee, manager"`) |
| Email already registered | `409` | `"Email is already registered"`, `data: null` |

---

### `POST /api/auth/login`

| | |
| --- | --- |
| **Auth** | none |
| **Body** | `{ "email": "...", "password": "..." }` (both required) |

```json
{ "email": "ada@example.com", "password": "securePass123" }
```

**Success — `200`** — same shape as register: `data.user` + `data.token`.

**Errors**

| Case | Status | Message |
| --- | --- | --- |
| Wrong password **or** unknown email | `401` | `Invalid email or password` (identical for both — accounts are never enumerated) |
| Missing/invalid payload | `400` | `Validation failed` |

---

### `GET /api/auth/me`

Returns the authenticated user — use it to restore a session after a page reload.

| | |
| --- | --- |
| **Auth** | required |
| **Role** | any |
| **Params / body** | none |

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

**Errors:** `401` with `Authentication token missing` / `Authentication token invalid` / `Authentication token expired` / `Authentication failed: user no longer exists`.

---

### `POST /api/expenses`

Creates an expense for the **authenticated** employee. Ownership and status are decided by the server.

| | |
| --- | --- |
| **Auth** | required |
| **Role** | `employee` (a manager calling this gets `403`) |
| **Body** | see below |

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `title` | string | yes | 1–120 characters |
| `amount` | number | yes | greater than `0` |
| `category` | string | yes | 1–60 characters (free text, e.g. `Transport`, `Food`, `Supplies`) |
| `expenseDate` | string/date | yes | valid date; alias: **`date`** |
| `description` | string | no | max 500 characters |
| `receiptDetails` | string | no | max 1000 characters (plain text receipt info — there are no file uploads) |

Ignored if sent: `status`, `submittedBy`, `employeeId`, `userId`, `reviewedBy`, `reviewedAt`, `rejectionReason`.

```json
{
  "title": "Transportation",
  "amount": 5000,
  "category": "Transport",
  "date": "2026-09-29",
  "description": "Transportation for school activity",
  "receiptDetails": "Taxi receipt #4821"
}
```

**Success — `201`**

```json
{
  "success": true,
  "message": "Expense created successfully",
  "data": {
    "expense": {
      "_id": "6ab7d6ef2c3bcb55b6737108",
      "id": "6ab7d6ef2c3bcb55b6737108",
      "title": "Transportation",
      "description": "Transportation for school activity",
      "amount": 5000,
      "category": "Transport",
      "receiptDetails": "Taxi receipt #4821",
      "expenseDate": "2026-09-29T00:00:00.000Z",
      "status": "pending",
      "rejectionReason": null,
      "submittedBy": "6ab7d6dfe953d78bf3c17877",
      "reviewedBy": null,
      "reviewedAt": null,
      "createdAt": "2026-09-29T10:15:02.114Z",
      "updatedAt": "2026-09-29T10:15:02.114Z"
    }
  }
}
```

> On create, `submittedBy` is a plain id string. On list/detail/approval responses it is a **populated object** (`{ "_id", "name", "email", "role" }`). Always read the user id as `expense.submittedBy._id ?? expense.submittedBy`.

**Errors**

| Case | Status | Message |
| --- | --- | --- |
| Missing/invalid fields | `400` | `Validation failed` + `data.errors` (`amount: "must be greater than 0"`, `expenseDate: "must be a valid date"`, …) |
| Not authenticated | `401` | `Authentication token …` |
| Manager calls it | `403` | `Access denied: employee role required` |

---

### `GET /api/expenses`

Lists expenses. **Employees receive only their own**; **managers receive every expense**. The scope is applied inside the database query — there is no way to widen it from the client.

| | |
| --- | --- |
| **Auth** | required |
| **Role** | any (`employee` → own expenses, `manager` → all expenses) |

**Query parameters (all optional)**

| Param | Type | Allowed values | Default | Behavior |
| --- | --- | --- | --- | --- |
| `status` | string | `pending`, `approved`, `rejected` | — | exact match |
| `category` | string | 1–60 chars | — | exact whole-value match, case-insensitive (`transport` = `Transport`, does **not** match `Transportation`) |
| `fromDate` | date | e.g. `2026-09-01` | — | `expenseDate >= fromDate` (date-only value starts at 00:00:00 UTC) |
| `toDate` | date | e.g. `2026-09-30` | — | `expenseDate <= toDate` (date-only value includes the whole day, until 23:59:59.999 UTC) |
| `sortBy` | string | `date`, `amount`, `createdAt`, `updatedAt`, `status` | `createdAt` | anything else → `400` |
| `sortOrder` | string | `asc`, `desc` | `desc` | applies to `sortBy` (or the default field) |
| `page` | number | ≥ 1 | `1` | page number |
| `limit` | number | ≥ 1 | `10` | clamped to a maximum of `100` |

Unknown query parameters are ignored. Filters, sorting and pagination combine (AND semantics). Date range with `fromDate > toDate` → `400` (`fromDate: "must not be after toDate"`).

**Example**

```http
GET /api/expenses?status=pending&category=Transport&fromDate=2026-09-01&toDate=2026-09-30&sortBy=amount&sortOrder=desc&page=1&limit=10
Authorization: Bearer <employee JWT>
```

**Success — `200`**

```json
{
  "success": true,
  "message": "Expenses fetched successfully",
  "data": {
    "expenses": [
      {
        "_id": "6ab7d6ef2c3bcb55b6737108",
        "id": "6ab7d6ef2c3bcb55b6737108",
        "title": "Transportation",
        "amount": 5000,
        "category": "Transport",
        "expenseDate": "2026-09-29T00:00:00.000Z",
        "status": "pending",
        "rejectionReason": null,
        "submittedBy": { "_id": "6ab7d6dfe953d78bf3c17877", "name": "Ada Lovelace", "email": "ada@example.com", "role": "employee" },
        "reviewedBy": null,
        "reviewedAt": null,
        "createdAt": "2026-09-29T10:15:02.114Z",
        "updatedAt": "2026-09-29T10:15:02.114Z"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 }
  }
}
```

**Errors:** `401` unauthenticated · `400` invalid `status`/`sortBy`/`sortOrder`/`page`/`limit`/date filters.

> **Security:** for an employee, `?status=pending` means *"my pending expenses"*, never *"everyone's pending expenses"*.

---

### `GET /api/expenses/:id`

| | |
| --- | --- |
| **Auth** | required |
| **Role** | any, but an employee may only read **their own** expense; a manager may read any |
| **Params** | `id` — 24-character MongoDB ObjectId |

**Success — `200`** — `data.expense` exactly as in the list example (with populated `submittedBy` / `reviewedBy`).

**Errors**

| Case | Status | Message |
| --- | --- | --- |
| `id` is not a valid ObjectId | `400` | `Validation failed` (`id: "must be a valid id"`) |
| Expense does not exist **or** belongs to another employee | `404` | `Expense not found` |
| Not authenticated | `401` | `Authentication token …` |

> Foreign expenses intentionally return `404`, not `403`, so the API never reveals that another user's expense exists.

---

### `PATCH /api/expenses/:id`

Updates an expense. Only the owner may edit, and only while it is `pending`.

| | |
| --- | --- |
| **Auth** | required |
| **Role** | `employee` |
| **Params** | `id` |
| **Body** | any subset of the create fields (`title`, `amount`, `category`, `expenseDate`/`date`, `description`, `receiptDetails`) |

```json
{ "title": "Transportation (updated)", "amount": 5200 }
```

Never applied: `status`, `submittedBy`, `reviewedBy`, `reviewedAt`, `rejectionReason` — they are silently ignored.

**Success — `200`**

```json
{
  "success": true,
  "message": "Expense updated successfully",
  "data": { "expense": { "_id": "...", "title": "Transportation (updated)", "amount": 5200, "status": "pending" } }
}
```

**Errors**

| Case | Status | Message |
| --- | --- | --- |
| Not the owner / does not exist | `404` | `Expense not found` |
| Already `approved` or `rejected` | `409` | `Expense has already been approved` / `… rejected` |
| Invalid field values | `400` | `Validation failed` |
| Manager calls it | `403` | `Access denied: employee role required` |

---

### `DELETE /api/expenses/:id`

Deletes the owner's expense **while it is still `pending`**. Finalized expenses are kept as the audit trail of the decision.

| | |
| --- | --- |
| **Auth** | required |
| **Role** | `employee` |
| **Params** | `id` |

**Success — `200`**

```json
{ "success": true, "message": "Expense deleted successfully", "data": null }
```

**Errors:** `404` not yours/nonexistent · `409` already approved/rejected · `400` invalid id · `403` manager role.

---

### `PATCH /api/expenses/:id/approve`

Approves a pending expense. Final.

| | |
| --- | --- |
| **Auth** | required |
| **Role** | `manager` |
| **Params** | `id` |
| **Body** | none |

**Success — `200`**

```json
{
  "success": true,
  "message": "Expense approved",
  "data": {
    "expense": {
      "_id": "6ab7d6ef2c3bcb55b6737108",
      "status": "approved",
      "rejectionReason": null,
      "submittedBy": { "_id": "6ab7d6dfe953d78bf3c17877", "name": "Ada Lovelace", "email": "ada@example.com", "role": "employee" },
      "reviewedBy": { "_id": "6ab7d6ede953d78bf3c1787d", "name": "Mary Manager", "email": "mary@example.com", "role": "manager" },
      "reviewedAt": "2026-09-29T11:00:00.185Z"
    }
  }
}
```

**Errors**

| Case | Status | Message |
| --- | --- | --- |
| Not authenticated | `401` | `Authentication token …` |
| Employee calls it | `403` | `Access denied: manager role required` |
| Invalid `id` | `400` | `Validation failed` (`id: "must be a valid id"`) |
| Expense does not exist | `404` | `Expense not found` |
| Already approved or rejected | `409` | `Expense has already been approved` / `… rejected` |

---

### `PATCH /api/expenses/:id/reject`

Rejects a pending expense. A reason is **mandatory**. Final.

| | |
| --- | --- |
| **Auth** | required |
| **Role** | `manager` |
| **Params** | `id` |

**Request body**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `rejectionReason` | string | yes | 3–500 characters, cannot be blank (alias: `reason`) |

```json
{ "rejectionReason": "The expense does not include sufficient supporting details." }
```

**Success — `200`**

```json
{
  "success": true,
  "message": "Expense rejected",
  "data": {
    "expense": {
      "_id": "6ab7d77029d0ab10bb469bf8",
      "status": "rejected",
      "rejectionReason": "The expense does not include sufficient supporting details.",
      "reviewedBy": { "_id": "6ab7d6ede953d78bf3c1787d", "name": "Mary Manager", "role": "manager" },
      "reviewedAt": "2026-09-29T11:03:32.619Z"
    }
  }
}
```

**Errors**

| Case | Status | Message |
| --- | --- | --- |
| Missing/blank/short reason | `400` | `Validation failed` (`rejectionReason: "is required"` / `"must be at least 3 characters"`) |
| Employee calls it | `403` | `Access denied: manager role required` |
| Invalid `id` | `400` | `Validation failed` |
| Expense does not exist | `404` | `Expense not found` |
| Already approved or rejected | `409` | `Expense has already been approved` / `… rejected` |

---

## 10. Authentication examples

```javascript
const API_URL = "http://localhost:5000/api";

// 1. register
const registerResponse = await fetch(`${API_URL}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "securePass123",
    role: "employee",
  }),
});
const registerData = await registerResponse.json();
// registerData.data.token, registerData.data.user.role

// 2. login
const loginResponse = await fetch(`${API_URL}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "ada@example.com", password: "securePass123" }),
});
const loginData = await loginResponse.json();

if (loginData.success) {
  localStorage.setItem("token", loginData.data.token);
  localStorage.setItem("role", loginData.data.user.role); // to pick the UI
}
```

With axios:

```javascript
import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:5000/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const response = await api.post("/auth/login", { email, password });
const { token, user } = response.data.data;
```

Sending the token manually:

```javascript
await fetch(`${API_URL}/expenses`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

---

## 11. Expense examples

All examples assume `token` (JWT) and `API_URL` are set. Only the response `data` is shown for brevity.

### Create an expense

```javascript
const res = await fetch(`${API_URL}/expenses`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    title: "Transportation",
    amount: 5000,
    category: "Transport",
    date: "2026-09-29",
    description: "Transportation for school activity",
    receiptDetails: "Taxi receipt #4821",
  }),
});
const { data } = await res.json(); // data.expense.status === "pending"
```

### Fetch expenses (employee: own only / manager: all)

```javascript
const params = new URLSearchParams({
  status: "pending",
  category: "Transport",
  fromDate: "2026-09-01",
  toDate: "2026-09-30",
  sortBy: "amount",
  sortOrder: "desc",
  page: "1",
  limit: "10",
});
const res = await fetch(`${API_URL}/expenses?${params}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { data } = await res.json();
// data.expenses → array, data.pagination → { page, limit, total, totalPages }
```

### Fetch one expense

```javascript
const res = await fetch(`${API_URL}/expenses/${expenseId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { data } = await res.json(); // data.expense; 404 if not yours
```

### Update an expense (owner + pending only)

```javascript
const res = await fetch(`${API_URL}/expenses/${expenseId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ title: "Transportation", amount: 5200 }),
});
```

### Delete an expense (owner + pending only)

```javascript
const res = await fetch(`${API_URL}/expenses/${expenseId}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}` },
});
```

### Approve (manager only)

```javascript
const res = await fetch(`${API_URL}/expenses/${expenseId}/approve`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}` },
});
// 200 → data.expense.status === "approved"
// 409 → already finalized
```

### Reject (manager only, reason required)

```javascript
const res = await fetch(`${API_URL}/expenses/${expenseId}/reject`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    rejectionReason: "The expense does not include sufficient supporting details.",
  }),
});
// 200 → data.expense.status === "rejected", data.expense.rejectionReason set
```

---

## 12. Expense status behavior

```text
pending ──approve──> approved     (final)
pending ──reject───> rejected     (final, stores rejectionReason)
```

| Transition | Allowed? | Result |
| --- | --- | --- |
| `pending → approved` | ✅ | `200 Expense approved` |
| `pending → rejected` | ✅ | `200 Expense rejected` (reason stored) |
| `approved → approved` | ❌ | `409 Expense has already been approved` |
| `approved → rejected` | ❌ | `409 Expense has already been approved` |
| `rejected → rejected` | ❌ | `409 Expense has already been rejected` |
| `rejected → approved` | ❌ | `409 Expense has already been rejected` |

Related rules:

- Creation always yields `pending`; clients cannot create an approved expense.
- Employees may edit/delete **only** their own `pending` expenses; finalized expenses return `409`.
- `rejectionReason` is `null` for pending/approved expenses and set only on rejection.
- `reviewedBy` / `reviewedAt` are written by the approval endpoints only.

---

## 13. Error handling

Every error looks like this:

```json
{ "success": false, "message": "Expense not found", "data": null }
```

Validation errors add field details:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": { "errors": { "amount": "must be greater than 0" } }
}
```

### What you will never see

Stack traces, `CastError`, `ValidationError`, `MongoServerError`, `AxiosError`, password hashes, JWT secrets, database internals. Server-side failures are logged on the backend and answered with `500` + `"Something went wrong"`.

### Common messages

| Message | Status | What to do |
| --- | --- | --- |
| `Validation failed` | `400` | map `data.errors` onto your form fields |
| `Invalid JSON in request body` | `400` | fix the request body serialization |
| `Authentication token missing` | `401` | add the `Authorization` header |
| `Authentication token invalid` | `401` | token tampered/malformed → re-login |
| `Authentication token expired` | `401` | token expired → re-login |
| `Invalid email or password` | `401` | show "wrong credentials" |
| `Access denied: manager role required` | `403` | route the user to the employee UI |
| `Access denied: employee role required` | `403` | route the user to the manager UI |
| `Route not found: GET /api/nope` | `404` | wrong URL |
| `Expense not found` | `404` | missing, already deleted, or not yours |
| `Email is already registered` | `409` | suggest login instead |
| `Expense has already been approved/rejected` | `409` | refresh the list — someone else acted |
| `Something went wrong` | `500` | retry / show generic failure |

---

## 14. Frontend Integration Guide

### 14.1 Authenticate

```text
register → login → store token + user → send token on every call
```

Store both `token` and `user` from `data`. The `user.role` decides which UI you render.

### 14.2 Attach the JWT

```http
Authorization: Bearer <token>
```

Attach it to **every** request except `POST /api/auth/register`, `POST /api/auth/login`, `GET /` and `GET /api/health`.

### 14.3 Determine the user role

- On login/register: `response.data.data.user.role`.
- After a reload: `GET /api/auth/me` → `response.data.user.role`.
- Trust the role only for **UI decisions** (which screens to show). Authorization is enforced by the backend anyway.

### 14.4 Fetch employee expenses

```javascript
const { data } = await api.get("/expenses"); // employee → own expenses only
setExpenses(data.data.expenses);
setPagination(data.data.pagination);
```

Add filters as query params (`status`, `category`, `fromDate`, `toDate`, `sortBy`, `sortOrder`, `page`, `limit`). The backend still scopes the result to the logged-in employee.

### 14.5 Fetch manager expenses

Same endpoint — the backend widens the scope for managers:

```javascript
const { data } = await api.get("/expenses", { params: { status: "pending" } });
```

Use `GET /api/expenses/:id` to open the review detail screen.

### 14.6 Submit expenses

```javascript
const { data } = await api.post("/expenses", {
  title, amount: Number(amount), category, date, description, receiptDetails,
});
// data.expense.status === "pending" → show "Awaiting review"
```

Send `amount` as a **number**. Send the date as `YYYY-MM-DD`. Do not send `status` — it is ignored and always starts as `pending`.

### 14.7 Loading states

```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

async function load() {
  setLoading(true);
  setError(null);
  try {
    const { data } = await api.get("/expenses", { params });
    setExpenses(data.data.expenses);
  } catch (e) {
    setError(e.response?.data?.message ?? "Something went wrong");
  } finally {
    setLoading(false);
  }
}
```

Disable approve/reject/submit buttons while their request is in flight, then refresh the list from the response (it already contains the updated expense).

### 14.8 Handle API errors

```javascript
function handleApiError(error) {
  const status = error.response?.status;
  const body = error.response?.data;

  if (status === 400 && body?.data?.errors) {
    return body.data.errors; // { amount: "must be greater than 0", ... } → field errors
  }
  if (status === 401) {
    localStorage.removeItem("token");
    window.location.assign("/login"); // token missing/invalid/expired
    return null;
  }
  if (status === 403) {
    window.location.assign("/"); // wrong role for that screen
    return null;
  }
  if (status === 409) {
    return { conflict: body.message }; // expense already processed → refresh list
  }
  return { general: body?.message ?? "Something went wrong" };
}
```

### 14.9 Display statuses

| Status | Suggested label | Colour hint |
| --- | --- | --- |
| `pending` | Awaiting review | amber/grey |
| `approved` | Approved | green |
| `rejected` | Rejected | red |

### 14.10 Display rejection reasons

When `expense.status === "rejected"`, show `expense.rejectionReason` to the employee (it is `null` otherwise). It is returned on the list, on the detail fetch and on the reject response.

### 14.11 When to redirect

| Situation | Redirect to |
| --- | --- |
| `401` (no/invalid/expired token) | login screen (clear the stored token first) |
| `403` employee on a manager screen | employee dashboard |
| `403` manager on an employee-only screen | manager dashboard |
| `404` on an expense you expected to exist | list screen + refresh (it may have been deleted, or it is not yours) |
| `409` on approve/reject/edit/delete | refresh the list — the expense was finalized by someone else |

### 14.12 Practical checklist

- [ ] Store `token` and `user` from login/register
- [ ] Send `Authorization: Bearer <token>` on all protected calls
- [ ] Use `GET /api/auth/me` to restore the session
- [ ] Branch the UI on `user.role` (`employee` / `manager`)
- [ ] Send `amount` as a number and dates as `YYYY-MM-DD`
- [ ] Render `data.errors` (object keyed by field) as inline form errors
- [ ] Render `pagination` for the expense list
- [ ] Treat `pending → approved/rejected` as final; refresh on `409`
- [ ] Never assume success from HTTP 200 alone — always check `success` in the body
- [ ] On `401`, log out; on `403`, leave the screen

---

## 15. Example frontend API service layer

```javascript
// src/api/client.js
import axios from "axios";

export const API_URL = "http://localhost:5000/api";

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

export default api;
```

```javascript
// src/api/auth.js
import api from "./client";

export async function register(payload) {
  const { data } = await api.post("/auth/register", payload);
  return data.data; // { user, token }
}

export async function login(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  return data.data; // { user, token }
}

export async function me() {
  const { data } = await api.get("/auth/me");
  return data.data.user;
}
```

```javascript
// src/api/expenses.js
import api from "./client";

export async function listExpenses(params = {}) {
  const { data } = await api.get("/expenses", { params });
  return data.data; // { expenses, pagination }
}

export async function getExpense(id) {
  const { data } = await api.get(`/expenses/${id}`);
  return data.data.expense;
}

export async function createExpense(payload) {
  const { data } = await api.post("/expenses", payload);
  return data.data.expense; // status === "pending"
}

export async function updateExpense(id, payload) {
  const { data } = await api.patch(`/expenses/${id}`, payload);
  return data.data.expense;
}

export async function deleteExpense(id) {
  const { data } = await api.delete(`/expenses/${id}`);
  return data.message;
}

export async function approveExpense(id) {
  const { data } = await api.patch(`/expenses/${id}/approve`);
  return data.data.expense; // status === "approved"
}

export async function rejectExpense(id, rejectionReason) {
  const { data } = await api.patch(`/expenses/${id}/reject`, { rejectionReason });
  return data.data.expense; // status === "rejected"
}
```

> All helpers return `data.data` from the envelope. Axios rejects non-2xx responses, so `error.response.data.message` / `error.response.data.data.errors` give you the error envelope.

---

## 16. Complete endpoint matrix

| # | Method | Endpoint | Auth | Role | Purpose |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/` | no | — | API info |
| 2 | `GET` | `/api/health` | no | — | liveness check |
| 3 | `POST` | `/api/auth/register` | no | — | create account (body `role` picks employee/manager) |
| 4 | `POST` | `/api/auth/login` | no | — | log in → `{ user, token }` |
| 5 | `GET` | `/api/auth/me` | **yes** | any | current user (session restore) |
| 6 | `POST` | `/api/expenses` | **yes** | **employee** | create expense (always `pending`) |
| 7 | `GET` | `/api/expenses` | **yes** | any | list — employee: own, manager: all; filters, sorting, pagination |
| 8 | `GET` | `/api/expenses/:id` | **yes** | owner or manager | read one expense (`404` if not yours) |
| 9 | `PATCH` | `/api/expenses/:id` | **yes** | **employee** (owner) | edit own expense while `pending` |
| 10 | `DELETE` | `/api/expenses/:id` | **yes** | **employee** (owner) | delete own expense while `pending` |
| 11 | `PATCH` | `/api/expenses/:id/approve` | **yes** | **manager** | `pending → approved` |
| 12 | `PATCH` | `/api/expenses/:id/reject` | **yes** | **manager** | `pending → rejected` (reason required) |

### Query parameter matrix for `GET /api/expenses`

| Param | Values | Default |
| --- | --- | --- |
| `status` | `pending` \| `approved` \| `rejected` | all |
| `category` | any string ≤ 60 chars (case-insensitive exact match) | all |
| `fromDate` | valid date | — |
| `toDate` | valid date (`>= fromDate`) | — |
| `sortBy` | `date` \| `amount` \| `createdAt` \| `updatedAt` \| `status` | `createdAt` |
| `sortOrder` | `asc` \| `desc` | `desc` |
| `page` | integer ≥ 1 | `1` |
| `limit` | integer ≥ 1 (max 100) | `10` |

### Body field matrix for expenses

| Field | Create | Update | Type | Rules |
| --- | --- | --- | --- | --- |
| `title` | required | optional | string | ≤ 120 chars |
| `amount` | required | optional | number | > 0 |
| `category` | required | optional | string | ≤ 60 chars |
| `expenseDate` (alias `date`) | required | optional | date | valid date |
| `description` | optional | optional | string | ≤ 500 chars |
| `receiptDetails` | optional | optional | string | ≤ 1000 chars |
| `rejectionReason` | — | — | string | reject endpoint only: required, 3–500 chars |
| `status`, `submittedBy`, `reviewedBy`, `reviewedAt` | **ignored** | **ignored** | — | server-owned |

### Quick cURL tour

```bash
BASE=http://localhost:5000

# register a manager and an employee
curl -X POST $BASE/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Mary Manager","email":"mary@example.com","password":"securePass123","role":"manager"}'
curl -X POST $BASE/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ada Employee","email":"ada@example.com","password":"securePass123"}'

# login as the employee
EMP_TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"securePass123"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.token')

# create an expense
EXPENSE_ID=$(curl -s -X POST $BASE/api/expenses -H "Authorization: Bearer $EMP_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Taxi","amount":5000,"category":"Transport","date":"2026-09-29","description":"School run"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.expense.id')

# list with filters
curl "$BASE/api/expenses?status=pending&sortBy=amount&sortOrder=desc&page=1&limit=10" \
  -H "Authorization: Bearer $EMP_TOKEN"

# login as the manager and review it
MGR_TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"mary@example.com","password":"securePass123"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.token')

curl -X PATCH $BASE/api/expenses/$EXPENSE_ID/approve -H "Authorization: Bearer $MGR_TOKEN"
curl -X PATCH $BASE/api/expenses/$EXPENSE_ID/reject -H "Authorization: Bearer $MGR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"rejectionReason":"Missing receipt details"}'

# the employee sees the final status
curl $BASE/api/expenses/$EXPENSE_ID -H "Authorization: Bearer $EMP_TOKEN"
```

---

## Security notes (for the team)

- Passwords are bcrypt-hashed; no endpoint ever returns `password` or a hash.
- Secrets live only in `.env` (git-ignored). `.env.example` holds placeholders only.
- JWTs are verified on every protected request; the payload carries only `id` + `role`.
- Ownership and role checks happen server-side; the frontend is never trusted for either.
- Mass assignment is blocked by field whitelists in the services (create/update accept only editable fields).
- Invalid ObjectIds return `400` — Mongo `CastError`s never reach the client.

## Tests

```bash
npm test
```

`117` tests across `tests/` (auth, authorization, validation, expenses, listing/isolation, approval, response shape, security). They run against a local MongoDB database named `expense-approval-test`, which is dropped before and after the run. Run the suite before merging any change.
