BEGIN;

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

COMMIT;
