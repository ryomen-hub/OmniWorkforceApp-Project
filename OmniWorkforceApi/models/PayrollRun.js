import db from "../config/db.js";
import {
  calculatePayslipTotals,
  parseMonthlyBaseSalary,
} from "../services/payroll-calculations.js";

async function getPayslips(client, runId) {
  const { rows } = await client.query(
    `SELECT * FROM payslips
     WHERE payroll_run_id = $1
     ORDER BY employee_name, employee_code`,
    [runId]
  );
  return rows;
}

const PayrollRun = {
  async getAll() {
    const { rows } = await db.query(
      `SELECT payroll_runs.*,
         COUNT(payslips.id)::int AS employee_count,
         COALESCE(SUM(payslips.net_pay), 0)::numeric(12, 2) AS total_net_pay
       FROM payroll_runs
       LEFT JOIN payslips ON payslips.payroll_run_id = payroll_runs.id
       GROUP BY payroll_runs.id
       ORDER BY payroll_runs.period_start DESC, payroll_runs.id DESC`
    );
    return rows;
  },

  async getById(id) {
    const { rows } = await db.query("SELECT * FROM payroll_runs WHERE id = $1", [id]);
    if (!rows[0]) return null;
    return { ...rows[0], payslips: await getPayslips(db, id) };
  },

  async getPaidPayslipsForUser(userId) {
    const { rows } = await db.query(
      `SELECT payslips.*, payroll_runs.period_start, payroll_runs.period_end,
         payroll_runs.payout_date, payroll_runs.status
       FROM users
       JOIN applicants ON lower(btrim(applicants.email)) = lower(btrim(users.email))
       JOIN payroll_records ON payroll_records.applicant_id = applicants.id
       JOIN payslips ON payslips.payroll_record_id = payroll_records.id
       JOIN payroll_runs ON payroll_runs.id = payslips.payroll_run_id
       WHERE users.id = $1 AND payroll_runs.status = 'Paid'
       ORDER BY payroll_runs.period_start DESC, payslips.id DESC`,
      [userId]
    );
    return rows;
  },

  async create({ period_start, period_end, payout_date, created_by }) {
    const client = await db.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const { rows: records } = await client.query(
        `SELECT payroll_records.id, payroll_records.employee_code,
           payroll_records.position, payroll_records.base_salary,
           applicants.name AS employee_name
         FROM payroll_records
         LEFT JOIN applicants ON applicants.id = payroll_records.applicant_id
         ORDER BY payroll_records.id`
      );
      if (records.length === 0) {
        const error = new Error("There are no payroll records to include in a payroll run.");
        error.status = 400;
        throw error;
      }

      const prepared = records.map((record) => {
        if (!record.employee_code) {
          const error = new Error(`Payroll record ${record.id} needs an employee ID before a run can be created.`);
          error.status = 400;
          throw error;
        }
        if (!record.employee_name?.trim()) {
          const error = new Error(`Payroll record ${record.id} needs an employee name before a run can be created.`);
          error.status = 400;
          throw error;
        }
        const monthlyBase = parseMonthlyBaseSalary(record.base_salary);
        return {
          ...record,
          monthly_base_salary: monthlyBase,
          basic_pay: Number((monthlyBase / 2).toFixed(2)),
        };
      });

      const { rows: [run] } = await client.query(
        `INSERT INTO payroll_runs (period_start, period_end, payout_date, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [period_start, period_end, payout_date, created_by]
      );

      for (const record of prepared) {
        const totals = calculatePayslipTotals(record.basic_pay, [], []);
        await client.query(
          `INSERT INTO payslips (
             payroll_run_id, payroll_record_id, employee_code, employee_name,
             position, monthly_base_salary, basic_pay, gross_pay,
             total_deductions, net_pay
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            run.id,
            record.id,
            record.employee_code,
            record.employee_name.trim(),
            record.position,
            record.monthly_base_salary,
            record.basic_pay,
            totals.gross_pay,
            totals.total_deductions,
            totals.net_pay,
          ]
        );
      }
      await client.query("COMMIT");
      transactionOpen = false;
      return this.getById(run.id);
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async updatePayslipLines(runId, slipId, earnings, deductions) {
    const client = await db.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const { rows: [run] } = await client.query(
        "SELECT status FROM payroll_runs WHERE id = $1 FOR UPDATE",
        [runId]
      );
      if (!run) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return { kind: "not-found" };
      }
      if (run.status !== "Draft") {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return { kind: "locked" };
      }
      const { rows: [slip] } = await client.query(
        `SELECT basic_pay, earnings, deductions FROM payslips
         WHERE id = $1 AND payroll_run_id = $2 FOR UPDATE`,
        [slipId, runId]
      );
      if (!slip) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return { kind: "not-found" };
      }
      const nextEarnings = earnings ?? slip.earnings;
      const nextDeductions = deductions ?? slip.deductions;
      const totals = calculatePayslipTotals(slip.basic_pay, nextEarnings, nextDeductions);
      const { rows: [updated] } = await client.query(
        `UPDATE payslips SET earnings = $1, deductions = $2,
           gross_pay = $3, total_deductions = $4, net_pay = $5
         WHERE id = $6 AND payroll_run_id = $7
         RETURNING *`,
        [JSON.stringify(nextEarnings), JSON.stringify(nextDeductions),
          totals.gross_pay, totals.total_deductions, totals.net_pay, slipId, runId]
      );
      await client.query("COMMIT");
      transactionOpen = false;
      return { kind: "updated", slip: updated };
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async transition(id, status, userId) {
    const transitions = {
      Draft: { next: "Reviewed", actor: "reviewed_by" },
      Reviewed: { next: "Approved", actor: "approved_by" },
      Approved: { next: "Paid", actor: "paid_by" },
    };
    const client = await db.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const { rows: [run] } = await client.query(
        "SELECT status FROM payroll_runs WHERE id = $1 FOR UPDATE",
        [id]
      );
      if (!run) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return { kind: "not-found" };
      }
      const transition = transitions[run.status];
      if (!transition || transition.next !== status) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return { kind: "invalid-transition", current: run.status };
      }
      if (status === "Reviewed" || status === "Approved") {
        const { rows: [result] } = await client.query(
          `SELECT EXISTS (
             SELECT 1 FROM payslips
             WHERE payroll_run_id = $1 AND net_pay < 0
           ) AS has_negative_net_pay`,
          [id]
        );
        if (result.has_negative_net_pay) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return { kind: "negative-net-pay" };
        }
      }
      const actorColumn = transition.actor;
      const { rows: [updated] } = await client.query(
        `UPDATE payroll_runs SET status = $1, ${actorColumn} = $2,
           updated_at = now()
         WHERE id = $3 RETURNING *`,
        [status, userId, id]
      );
      await client.query("COMMIT");
      transactionOpen = false;
      return { kind: "updated", run: updated };
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export default PayrollRun;
