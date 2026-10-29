import PayrollRun from "../models/PayrollRun.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { normalizePayrollLines } from "../services/payroll-calculations.js";

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const validSemiMonthlyPeriod = (start, end) => {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const sameMonth = startDate.getUTCFullYear() === endDate.getUTCFullYear()
    && startDate.getUTCMonth() === endDate.getUTCMonth();
  if (!sameMonth) return false;
  if (startDate.getUTCDate() === 1) return endDate.getUTCDate() === 15;
  if (startDate.getUTCDate() !== 16) return false;
  return endDate.getUTCDate() === new Date(Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth() + 1,
    0
  )).getUTCDate();
};

export const getAll = asyncHandler(async (req, res) => {
  res.json(await PayrollRun.getAll());
});

export const getOne = asyncHandler(async (req, res) => {
  const run = await PayrollRun.getById(req.params.id);
  if (!run) return res.status(404).json({ error: "Payroll run not found" });
  res.json(run);
});

export const getMyPayslips = asyncHandler(async (req, res) => {
  res.json(await PayrollRun.getPaidPayslipsForUser(req.user.id));
});

export const create = asyncHandler(async (req, res) => {
  const { period_start, period_end, payout_date } = req.body;
  if (!validDate(period_start) || !validDate(period_end) || !validDate(payout_date)) {
    return res.status(400).json({ error: "period_start, period_end, and payout_date must be valid YYYY-MM-DD dates" });
  }
  if (period_end < period_start) {
    return res.status(400).json({ error: "period_end cannot be before period_start" });
  }
  if (!validSemiMonthlyPeriod(period_start, period_end)) {
    return res.status(400).json({ error: "Pay periods must be the 1st–15th or the 16th through the last day of the same month." });
  }
  res.status(201).json(await PayrollRun.create({
    period_start,
    period_end,
    payout_date,
    created_by: req.user.id,
  }));
});

export const updatePayslipLines = asyncHandler(async (req, res) => {
  const { earnings, deductions } = req.body;
  if (earnings === undefined && deductions === undefined) {
    return res.status(400).json({ error: "Provide earnings, deductions, or both" });
  }
  const normalizedEarnings = earnings === undefined ? undefined : normalizePayrollLines(earnings, "earnings");
  const normalizedDeductions = deductions === undefined ? undefined : normalizePayrollLines(deductions, "deductions");
  const result = await PayrollRun.updatePayslipLines(
    req.params.runId,
    req.params.slipId,
    normalizedEarnings,
    normalizedDeductions
  );
  if (result.kind === "not-found") return res.status(404).json({ error: "Payroll run or payslip not found" });
  if (result.kind === "locked") {
    return res.status(409).json({ error: "Payslip lines can only be changed while the payroll run is Draft" });
  }
  res.json(result.slip);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const result = await PayrollRun.transition(req.params.id, req.body.status, req.user.id);
  if (result.kind === "not-found") return res.status(404).json({ error: "Payroll run not found" });
  if (result.kind === "invalid-transition") {
    return res.status(409).json({ error: `Cannot change payroll run from ${result.current} to ${req.body.status}` });
  }
  if (result.kind === "negative-net-pay") {
    return res.status(409).json({ error: "Correct payslips with deductions greater than gross pay before reviewing or approving this run." });
  }
  res.json(result.run);
});
