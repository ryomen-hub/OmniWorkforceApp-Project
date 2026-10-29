import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePayslipTotals,
  normalizePayrollLines,
  parseMonthlyBaseSalary,
} from "./payroll-calculations.js";

test("parses a single formatted monthly salary", () => {
  assert.equal(parseMonthlyBaseSalary("₱28,000 / mo + Benefits"), 28000);
});

test("rejects missing, invalid, and ambiguous salary values", () => {
  for (const salary of [
    "",
    "not provided",
    "28,000–35,000 / mo",
    "-28000",
    "600 per hour",
    "28k per month",
  ]) {
    assert.throws(() => parseMonthlyBaseSalary(salary), { status: 400 });
  }
});

test("validates manually entered payroll lines", () => {
  assert.deepEqual(normalizePayrollLines([
    { label: "Night differential", amount: "1200.50" },
  ], "earnings"), [{ label: "Night differential", amount: 1200.5 }]);
  assert.throws(() => normalizePayrollLines([
    { label: "Invalid amount", amount: "-1" },
  ], "deductions"), { status: 400 });
  assert.throws(() => normalizePayrollLines([
    { label: "Missing amount", amount: "" },
  ], "deductions"), { status: 400 });
});

test("calculates gross, deductions, and net in cents", () => {
  assert.deepEqual(calculatePayslipTotals(14000, [
    { label: "Bonus", amount: 1250.55 },
  ], [
    { label: "Loan", amount: 250.1 },
  ]), {
    gross_pay: 15250.55,
    total_deductions: 250.1,
    net_pay: 15000.45,
  });
});

test("keeps negative net pay visible for review gating", () => {
  assert.deepEqual(calculatePayslipTotals(10000, [], [
    { label: "Deductions", amount: 11000 },
  ]), {
    gross_pay: 10000,
    total_deductions: 11000,
    net_pay: -1000,
  });
});
