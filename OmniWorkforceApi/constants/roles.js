// Single source of truth for role names — used across every route file's
// requireRole(...) calls instead of retyping the literal string each time.
// Must stay in sync with the CHECK constraint in config/schema.sql.
export const ROLES = {
  ADMIN: "Admin Office",
  RECRUITERS_HR: "Recruiters & HR",
  RECRUITMENT: "Recruitment",
  PAYROLL: "Payroll Officers",
  EMPLOYEE: "Agent/Employee",
};

export const ALL_ROLES = Object.values(ROLES);
