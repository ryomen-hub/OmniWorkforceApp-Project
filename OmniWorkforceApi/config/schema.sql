-- Users: the five roles that log into the app, per the locked role/feature
-- table. Login is by email now, not an employee ID number — employee_id
-- has been removed entirely, not just deprecated.
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN (
    'Admin Office', 'Recruiters & HR', 'Recruitment', 'Payroll Officers', 'Agent/Employee'
  )),
  password   TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Applicants: referred candidates moving through the hiring pipeline.
-- Sourcing (create/view) is Admin, Recruiters & HR, and Recruitment.
-- Advancing their stage is Admin and Recruiters & HR only — Recruitment's
-- dashboard is read-only (job postings + pipeline overview, no edit control).
CREATE TABLE IF NOT EXISTS applicants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT,
  job_offer     TEXT,
  salary        TEXT,
  bpo_status    TEXT DEFAULT 'Pending Application',
  payout_status TEXT DEFAULT 'Pending Verification',
  referred_by   INTEGER REFERENCES users(id),
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Payroll records: created once an applicant is actually hired.
-- Deliberately back to its original shape here — the "Own Payslip"
-- self-service linking (user_id, salary_status) is Phase 3 work, not
-- Phase 1. Phase 1 is only roles + login.
CREATE TABLE IF NOT EXISTS payroll_records (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id  INTEGER REFERENCES applicants(id),
  employee_code TEXT UNIQUE,
  position      TEXT,
  base_salary   TEXT,
  sync_source   TEXT DEFAULT 'ATS Direct Sync',
  status        TEXT DEFAULT 'Auto-Synced',
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Main Board posts. Writing one is Admin, Recruiters & HR, and Payroll
-- only (matches "Post Announcement" in the feature table) — but the feed
-- itself is viewable by all 5 roles, since it's part of the shared
-- "Integrated System Modules" hub, not a gated feature.
CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id  INTEGER REFERENCES users(id),
  body       TEXT NOT NULL,
  image      TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Reactions: many-to-many between users and posts (one user, one type, per post)
CREATE TABLE IF NOT EXISTS reactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id),
  type       TEXT NOT NULL CHECK (type IN ('like', 'celebrate', 'insightful')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id, user_id, type)
);

-- Department email. All 5 roles have "Department Email" in the feature
-- table, so all 5 are valid recipient_role values here for now — whether
-- Agent/Employee's inbox is a shared department mailbox like the other 4,
-- or something more personal, is an open question deferred to whichever
-- phase actually builds out email/messenger in more depth.
CREATE TABLE IF NOT EXISTS emails (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id      INTEGER REFERENCES users(id),
  recipient      TEXT NOT NULL,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN (
    'Admin Office', 'Recruiters & HR', 'Recruitment', 'Payroll Officers', 'Agent/Employee'
  )),
  subject        TEXT NOT NULL,
  body           TEXT NOT NULL,
  folder         TEXT DEFAULT 'inbox',
  is_read        INTEGER DEFAULT 0,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Notification bell — per-user, all 5 roles get their own
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  title       TEXT NOT NULL,
  description TEXT,
  is_read     INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
