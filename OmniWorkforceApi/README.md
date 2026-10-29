# OmniWorkforce API

Express + Supabase (Postgres) backend for the OmniWorkforce app. Matches the
entities built in the frontend: Users, Applicants, Job Postings, Payroll Records,
Payroll Runs, Payslips, Posts (with reactions), Emails, Notifications,
Conversations, and Messages — with a full authentication and 5-role permission
layer on top.

## Setup

**1. Create a Supabase project** (free tier): [supabase.com](https://supabase.com) →
New Project. Takes a couple minutes to provision.

**2. Run the schema:** in your Supabase project's dashboard, go to
**SQL Editor → New query**, paste the entire contents of
`config/supabase-schema.sql`, and run it. This creates the base, job-posting,
messenger, and payroll tables.

**3. Get your connection string:** **Project Settings → Database →
Connection string → URI**. Copy it.

For an existing database, run the needed files in `config/migrations/` once
in the Supabase SQL Editor. `001_job_postings_and_messenger.sql` adds the job
posting link and messaging tables; `002_payroll_runs_and_payslips.sql` adds
payroll runs and payslip snapshots; `003_login_lockout.sql` adds persistent
failed-login tracking; `004_password_reset.sql` adds one-time reset tokens.
These migrations are additive; none runs the seed script.

**4. Configure and install:**
```
cp .env.example .env
# paste your server-side connection string into DATABASE_URL in .env
npm install
npm run seed     # DESTRUCTIVE: deletes existing app data and inserts demo data
npm run dev      # starts the server on http://localhost:4000
```

Seeded login accounts come from a JSON file, not from code:

- `config/seed-users.local.json` — **your real team accounts** (email, role, password). Git-ignored: never commit it, and leave it out of any zip you share or submit.
- `config/seed-users.example.json` — committed demo accounts, used only if the local file doesn't exist.

Each file needs exactly one account for each of the 5 roles. Emails are stored
lowercase and login ignores letter case. `npm run seed` deletes existing app
data before inserting demo data; do not run it on a database whose existing
data must be preserved.

## Authentication

Login uses **email + password plus a Cloudflare Turnstile CAPTCHA** — no role
picker, no employee ID. The account's role comes back from whatever's stored
on that record. CAPTCHA verification is performed server-side; login fails
closed if CAPTCHA is not configured or cannot be verified.

Configure `TURNSTILE_SECRET_KEY` in the API's ignored `.env` file and set
`TURNSTILE_ALLOWED_HOSTNAMES` to a comma-separated list of exact hostnames
allowed for your deployment (for local development, `localhost,127.0.0.1`).
In the frontend's ignored `.env` file, set `VITE_TURNSTILE_SITE_KEY` to the
matching Turnstile site key. Restart both development servers after changing
environment variables. Never place the secret key in frontend configuration.
The frontend includes `.env.example` as a template. Create a Turnstile widget
in Cloudflare and configure its site key, secret key, and allowed hostname
values before logging in; CAPTCHA is intentionally fail-closed when these are
missing.

Password recovery uses SMTP. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in the API `.env` file. Set
`PASSWORD_RESET_URL` to the frontend origin (for example,
`http://localhost:5173` for local development). For an existing database, run
`config/migrations/004_password_reset.sql` once in Supabase SQL Editor.
Reset links are single-use and expire after 30 minutes; only a SHA-256 hash of
the token is stored. Requests are rate-limited by IP and limited to one email
per account per minute. The API uses the same response whether or not the
email is registered. Password reset requires at least 8 characters and clears
any active login lockout.

```
POST /api/users/login
Body: { "email": "admin@omniworkforce.ph", "password": "test", "captchaToken": "..." }
Response: { "token": "eyJ...", "user": { "id": 1, "email": "...", "role": "Admin Office", ... } }
```

Every other route requires that token:
```
GET /api/applicants
Header: Authorization: Bearer eyJ...
```

No header (or a bad/expired token) → `401`. Logged in, but wrong role for
that action → `403`. Tokens expire after 8 hours (`JWT_EXPIRES_IN` in `.env`).
After four incorrect password attempts for an account, login is temporarily
blocked for 15 minutes. The counter is stored on the user record, resets after
a successful login or an Admin password reset, and starts over after the lock
expires. Login failures use the same response for unknown accounts, incorrect
passwords, and active lockouts. The existing per-IP login rate limit remains
in place as an additional protection.

### Who can do what

| | Admin Office | Recruiters & HR | Recruitment | Payroll Officers | Agent/Employee |
|---|---|---|---|---|---|
| Post Announcement | ✅ | ✅ | ❌ | ✅ | ❌ |
| Users & Profiles | ✅ | ✅ | ❌ | ❌ | ❌ |
| Applicants (view/advance) | ✅ | ✅ | view only | ❌ | ❌ |
| Applicants (delete) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Job postings (view) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Job postings (manage) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Payroll | ✅ | ❌ | ❌ | ✅ | ❌ |
| Payroll runs and payslips | ✅ | ❌ | ❌ | ✅ | ❌ |
| Own paid payslips | ❌ | own records | own records | ❌ | own records |
| Direct/group messages | ✅ | ✅ | ✅ | ✅ | ✅ |
| Department Email | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notifications (own) | ✅ | ✅ | ✅ | ✅ | ✅ |

Every write endpoint takes identity from the verified token (`req.user`),
never from the request body — `referred_by`, `author_id`, `sender_id`, and
message sender identity cannot be spoofed by changing a request value.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/users/login` | `{ email, password }` → `{ token, user }`. The only public route. Rate-limited to 10 attempts / 15 min per IP. |
| POST | `/api/users/password/forgot` | `{ email }` → generic response; sends a one-time password reset link when the account exists |
| POST | `/api/users/password/reset` | `{ token, password }` → consumes a valid reset link and updates the password |
| POST | `/api/users` | `{ email, role, password }` — Admin Office only |
| PATCH | `/api/users/:id/password` | `{ password }` — Admin Office only, hashes before storing |
| GET | `/api/applicants` | Admin Office, Recruiters & HR, Recruitment |
| PATCH | `/api/applicants/:id` | `{ bpo_status, payout_status }` — the "Advance Stage" button; Admin/HR only |
| GET | `/api/payroll` | Admin Office and Payroll Officers; payroll records include linked applicant email, job offer, and recruitment stage for ATS handover |
| GET | `/api/payroll-runs` | Admin Office, Payroll Officers |
| POST | `/api/payroll-runs` | Create a Draft run for the 1st–15th or 16th–month-end and snapshot each current payroll record; basic pay = monthly base salary ÷ 2 |
| GET | `/api/payroll-runs/:id` | Run details and payslip snapshots |
| GET | `/api/payroll-runs/me/payslips` | Recruiters & HR, Recruitment, and Agent/Employee; paid payslips matched to the authenticated account's email |
| PATCH | `/api/payroll-runs/:id/payslips/:slipId` | Set manually approved earnings/deduction lines while the run is Draft; totals are recalculated by the server |
| PATCH | `/api/payroll-runs/:id/status` | Advance only Draft → Reviewed → Approved → Paid; negative net pay blocks review and approval. Paid is a status record, not a bank transfer. |
| GET | `/api/job-postings` | Admin Office, Recruiters & HR, Recruitment |
| POST | `/api/job-postings` | Create a posting — Admin Office only |
| PATCH | `/api/job-postings/:id` | Update posting details/status — Admin Office only |
| DELETE | `/api/job-postings/:id` | Delete a posting — Admin Office only; linked applicants remain and become unassigned |
| GET | `/api/conversations` | Authenticated user's conversations |
| GET | `/api/conversations/colleagues` | Authenticated user's colleague list for starting direct or group messages (ID, email, and role only) |
| POST | `/api/conversations` | `{ member_ids, name? }` — create/open a direct chat or create a group; creator is included automatically |
| GET | `/api/conversations/:id/messages` | Messages for a conversation member |
| POST | `/api/conversations/:id/messages` | `{ body }` — send a message as a conversation member |
| PATCH | `/api/conversations/:id/read` | Mark a conversation read |
| GET | `/api/posts` | all Main Board posts with reaction counts, and whether *you* reacted to each |
| POST | `/api/posts/:id/reactions` | `{ type }` — toggles a reaction for you; `type` is `like`/`celebrate`/`insightful` |
| GET | `/api/emails?folder=inbox` | everything addressed to your department, each row with `sender_email`. `?folder=sent` = everything you wrote. |
| POST | `/api/emails` | `{ recipient, recipient_role, subject, body }` — `recipient_role` (a department) decides whose inbox it lands in |
| PATCH | `/api/emails/:id/read` | only works on mail addressed to your own department (`404` otherwise) |
| DELETE | `/api/emails/:id` | only mail you sent or that's in your department's inbox (`404` otherwise). An email is one shared row, so deleting removes it for the other side too |
| GET | `/api/notifications` | your own notifications only |
| PATCH | `/api/notifications/read-all` | marks all of *your* notifications read |

## What each folder does

- `server.js` — entry point. Starts Express, applies `helmet()` and rate
  limiting, mounts every router, includes the global Postgres error handler.
- `middleware/` — `auth.middleware.js` verifies the JWT and sets `req.user`;
  `role.middleware.js` checks `req.user.role` against a route's allowed list;
  `asyncHandler.js` wraps async route handlers so a rejected promise (a
  Postgres error) reaches Express's error handler instead of hanging.
- `config/db.js` — the Postgres connection pool (via `pg`), pointed at
  Supabase through `DATABASE_URL`.
- `config/supabase-schema.sql` — the actual schema, run manually in
  Supabase's SQL Editor (see Setup above). `config/schema.sql` is the old
  SQLite version, kept only as a historical reference — nothing imports it.
- `config/migrations/` — additive SQL migrations for databases created from
  an older schema; run each migration once in the Supabase SQL Editor.
- `services/payroll-calculations.js` — the agreed semi-monthly basic pay formula
  and server-side earnings/deduction totals. Statutory deductions, taxes,
  attendance adjustments, overtime, holiday pay, and other variable lines are
  entered manually as approved amounts; no rates are inferred. Payroll records
  with missing employee IDs/names, invalid salaries, or ambiguous salary ranges
  cannot be included in a run.
- Payroll tables have row-level security enabled and no direct client policies;
  payroll data is served through the authenticated API.
- `config/seed.js` — wipes and re-inserts demo data inside a real transaction
  (`BEGIN`/`COMMIT`/`ROLLBACK`), matching the frontend's expected data shape.
- `routes/` — the URL map plus which middleware (auth/role) guards each path.
  No business logic lives here.
- `controllers/` — validates input, calls the model, decides the
  response/status code. Every function is `async`, wrapped in `asyncHandler`.
- `models/` — the only files that touch the database directly, via `pg`'s
  async `db.query()` — every insert/update uses `RETURNING` to get the
  affected row back, since Postgres has no `lastInsertRowid` shortcut.

## Security

- **Passwords** — hashed with `bcryptjs`, never stored or compared as plain text.
- **Authentication** — `jsonwebtoken`, verified on every protected route.
- **Authorization** — role middleware enforces the table above per-route.
- **Rate limiting** — 10 login attempts / 15 min per IP; 300 requests / 15
  min per IP across the rest of the API.
- **HTTP headers** — `helmet()` on every response.
- **SQL injection** — not applicable by construction: every query uses `pg`'s
  parameterized `$1, $2...` placeholders, never string concatenation.
- **Identity spoofing** — closed. `author_id`, `sender_id`, `referred_by`,
  and reaction/notification ownership all come from `req.user`, never a
  client-supplied value.
- **Constraint violations** — the global error handler in `server.js`
  translates Postgres errors (duplicate email, invalid role, broken foreign
  key) into clean `400`/`409` responses instead of a raw `500` crash.

## A few things worth knowing about the pg conversion specifically

- **Everything is `async` now.** `better-sqlite3` was synchronous; `pg` is
  promise-based. Every model function, every controller function, needs
  `await` — this is why `asyncHandler` and the global error handler exist,
  neither was needed before.
- **`COUNT(*)` comes back as a string, not a number.** Postgres returns
  `BIGINT` aggregates as strings by default (to avoid silent precision loss
  on huge counts) — `models/Post.js` explicitly wraps reaction counts in
  `Number(...)` to convert them back.
- **Booleans and timestamps are now real types.** `is_read` is a genuine
  `BOOLEAN` (`true`/`false`), not `0`/`1`; `created_at` is a genuine
  `TIMESTAMPTZ`, not text. Both are improvements SQLite couldn't offer.

## Real-time (Socket.io)

Socket.io runs on the same server and port as Express. A client connects with
its JWT and is rejected without a valid one:

```js
io("http://localhost:4000", { auth: { token } })
```

Once connected, the server sends a `connected` event (confirms auth worked).
Each user also joins a private room, `user:<id>`, used later for notifications.

**Events the server broadcasts to every connected user (Main Board):**

| Event | Payload | Fired when |
|---|---|---|
| `post:created` | the full new post | someone publishes a post |
| `post:deleted` | `{ id }` | an Admin deletes a post |
| `post:reactions` | `{ postId, counts: { like, celebrate, insightful } }` | anyone toggles a reaction |

**Events sent to one specific user only (their private room, `user:<id>`):**

| Event | Payload | Fired when |
|---|---|---|
| `notification:new` | the saved notification row | (1) an applicant's stage changes — sent to whoever referred them, unless they made the change themselves; (2) an email is sent to a department — sent to everyone in that department except the sender |

Notifications are saved to the database first, then pushed live, so someone
who's offline finds them waiting (`GET /api/notifications`) and someone online
sees them arrive instantly. If saving/pushing a notification fails, it's logged
and the original action (advancing a stage, sending an email) still succeeds.

Security: broadcasts happen inside the controllers, *after* `requireAuth` and
`requireRole` have allowed the request, so a role that can't post never
triggers one. Reaction events carry counts only, never "did *you* react" —
one broadcast goes to everyone, so each client keeps its own reacted flag
from its own HTTP response.

Verification scripts (server must be running): `node test-socket.js`
(connection auth), `node test-realtime-posts.js` (live post events), and
`node test-realtime-notifications.js` (targeted notifications).

## Wiring this to the React frontend

`useAuth` calls this API for real — login is live. The rest (`useMainBoard`,
`useEmails`, `useNotifications`) still need the same treatment: replace their
hardcoded state with `fetch` calls, using `auth.authHeader` for the
`Authorization` header.
