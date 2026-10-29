function toCents(value) {
  return Math.round(Number(value) * 100);
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

export function parseMonthlyBaseSalary(value) {
  const salaryText = String(value ?? "").replace(/,/g, "");
  const amounts = salaryText.match(/\d+(?:\.\d{1,2})?/g) || [];
  const amount = amounts.length === 1 ? Number(amounts[0]) : NaN;
  const hasNegativeAmount = /(?:^|[^\d])-\s*\d/.test(salaryText);
  const hasUnsupportedPayBasis = /\b(?:hourly|daily|weekly|annual(?:ly)?|yearly)\b|per\s*(?:hour|day|week|year)|\d\s*k\b/i.test(salaryText);
  if (hasNegativeAmount || hasUnsupportedPayBasis || !Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) {
    const error = new Error("Every payroll record must have a valid positive monthly base salary.");
    error.status = 400;
    throw error;
  }
  return fromCents(toCents(amount));
}

export function normalizePayrollLines(lines, fieldName) {
  if (!Array.isArray(lines)) {
    const error = new Error(`${fieldName} must be a list of labeled amounts.`);
    error.status = 400;
    throw error;
  }
  if (lines.length > 50) {
    const error = new Error(`${fieldName} can contain at most 50 items.`);
    error.status = 400;
    throw error;
  }

  return lines.map((line, index) => {
    const label = typeof line?.label === "string" ? line.label.trim() : "";
    const rawAmount = typeof line?.amount === "number" ? String(line.amount) : String(line?.amount ?? "").trim();
    if (!label || label.length > 100 || !/^\d+(?:\.\d{1,2})?$/.test(rawAmount)) {
      const error = new Error(`${fieldName} item ${index + 1} needs a label (100 characters max) and a non-negative amount with up to 2 decimals.`);
      error.status = 400;
      throw error;
    }
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount > 9999999999.99) {
      const error = new Error(`${fieldName} item ${index + 1} has an invalid amount.`);
      error.status = 400;
      throw error;
    }
    return { label, amount: fromCents(toCents(amount)) };
  });
}

export function calculatePayslipTotals(basicPay, earnings, deductions) {
  const basicCents = toCents(basicPay);
  const earningsCents = earnings.reduce((sum, item) => sum + toCents(item.amount), 0);
  const deductionsCents = deductions.reduce((sum, item) => sum + toCents(item.amount), 0);
  const grossCents = basicCents + earningsCents;
  const netCents = grossCents - deductionsCents;
  const maxCents = toCents(9999999999.99);
  if (grossCents > maxCents || deductionsCents > maxCents) {
    const error = new Error("Payroll totals exceed the maximum supported amount.");
    error.status = 400;
    throw error;
  }

  return {
    gross_pay: fromCents(grossCents),
    total_deductions: fromCents(deductionsCents),
    net_pay: fromCents(netCents),
  };
}
