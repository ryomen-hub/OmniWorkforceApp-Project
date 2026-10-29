// Single source of truth for role names on the frontend — must stay in
// sync with constants/roles.js on the backend and the CHECK constraint
// in config/schema.sql. 5 roles now, replacing the original 3.
export const ROLES = Object.freeze({
  ADMIN: "Admin Office",
  RECRUITERS_HR: "Recruiters & HR",
  RECRUITMENT: "Recruitment",
  PAYROLL: "Payroll Officers",
  EMPLOYEE: "Agent/Employee",
});

export const ALL_ROLES = Object.values(ROLES);