-- OmniWorkforce — Supabase (Postgres) schema
-- Converted from config/schema.sql (SQLite). Run this in the Supabase
-- dashboard: Project → SQL Editor → New query → paste this whole file → Run.
--
-- What actually changed from the SQLite version, and why:
--   INTEGER PRIMARY KEY AUTOINCREMENT  →  BIGSERIAL PRIMARY KEY
--     Postgres's real auto-incrementing integer type — SQLite's version
--     was really just a special case of its own untyped column.
--   INTEGER REFERENCES ...             →  BIGINT REFERENCES ...
--     Foreign key columns need to match their target's real type now that
--     BIGSERIAL (a bigint underneath) is the primary key type.
--   TEXT DEFAULT CURRENT_TIMESTAMP     →  TIMESTAMPTZ DEFAULT now()
--     SQLite has no real date/time type, so timestamps were stored as
--     plain text. Postgres has an actual timestamp-with-timezone type —
--     using it means dates can be compared, sorted, and filtered
--     correctly instead of relying on lexical string ordering.
--   INTEGER DEFAULT 0 (for is_read)    →  BOOLEAN DEFAULT false
--     Same reasoning — SQLite has no boolean type, so 0/1 was a
--     workaround. Postgres has real booleans.
--   Everything else (table names, columns, CHECK constraints, relationships)
--   is unchanged — same 5 roles and permission structure.

CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN (
    'Admin Office', 'Recruiters & HR', 'Recruitment', 'Payroll Officers', 'Agent/Employee'
  )),
  password   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
  ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS job_postings (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Closed')),
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applicants (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT,
  job_offer     TEXT,
  salary        TEXT,
  bpo_status    TEXT DEFAULT 'Pending Application',
  payout_status TEXT DEFAULT 'Pending Verification',
  referred_by   BIGINT REFERENCES users(id),
  job_posting_id BIGINT REFERENCES job_postings(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applicants_job_posting_id_idx ON applicants(job_posting_id);

CREATE TABLE IF NOT EXISTS payroll_records (
  id            BIGSERIAL PRIMARY KEY,
  applicant_id  BIGINT REFERENCES applicants(id),
  employee_code TEXT UNIQUE,
  position      TEXT,
  base_salary   TEXT,
  sync_source   TEXT DEFAULT 'ATS Direct Sync',
  status        TEXT DEFAULT 'Auto-Synced',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payout_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Reviewed', 'Approved', 'Paid')),
  created_by BIGINT NOT NULL REFERENCES users(id),
  reviewed_by BIGINT REFERENCES users(id),
  approved_by BIGINT REFERENCES users(id),
  paid_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS payslips (
  id BIGSERIAL PRIMARY KEY,
  payroll_run_id BIGINT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  payroll_record_id BIGINT NOT NULL REFERENCES payroll_records(id),
  employee_code TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  position TEXT,
  monthly_base_salary NUMERIC(12, 2) NOT NULL CHECK (monthly_base_salary > 0),
  basic_pay NUMERIC(12, 2) NOT NULL CHECK (basic_pay >= 0),
  earnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  deductions JSONB NOT NULL DEFAULT '[]'::jsonb,
  gross_pay NUMERIC(12, 2) NOT NULL CHECK (gross_pay >= 0),
  total_deductions NUMERIC(12, 2) NOT NULL CHECK (total_deductions >= 0),
  net_pay NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, payroll_record_id)
);

CREATE INDEX IF NOT EXISTS payroll_runs_status_idx ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS payslips_payroll_run_id_idx ON payslips(payroll_run_id);
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS posts (
  id         BIGSERIAL PRIMARY KEY,
  author_id  BIGINT REFERENCES users(id),
  body       TEXT NOT NULL,
  image      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reactions (
  id         BIGSERIAL PRIMARY KEY,
  post_id    BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  user_id    BIGINT REFERENCES users(id),
  type       TEXT NOT NULL CHECK (type IN ('like', 'celebrate', 'insightful')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id, type)
);

CREATE TABLE IF NOT EXISTS emails (
  id             BIGSERIAL PRIMARY KEY,
  sender_id      BIGINT REFERENCES users(id),
  recipient      TEXT NOT NULL,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN (
    'Admin Office', 'Recruiters & HR', 'Recruitment', 'Payroll Officers', 'Agent/Employee'
  )),
  subject        TEXT NOT NULL,
  body           TEXT NOT NULL,
  folder         TEXT DEFAULT 'inbox',
  is_read        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id),
  title       TEXT NOT NULL,
  description TEXT,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((is_group AND name IS NOT NULL AND length(trim(name)) > 0) OR NOT is_group)
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_members_user_id_idx ON conversation_members(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages(conversation_id, created_at DESC);
