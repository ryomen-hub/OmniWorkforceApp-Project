import db from "../config/db.js";

const PayrollRecord = {
  async getAll() {
    const { rows } = await db.query(
      `SELECT payroll_records.*, applicants.name AS applicant_name,
         applicants.email AS applicant_email,
         applicants.bpo_status AS recruitment_stage,
         applicants.job_offer AS applicant_job_offer
       FROM payroll_records
       LEFT JOIN applicants ON applicants.id = payroll_records.applicant_id
       ORDER BY payroll_records.created_at DESC`
    );
    return rows;
  },

  async getById(id) {
    const { rows } = await db.query("SELECT * FROM payroll_records WHERE id = $1", [id]);
    return rows[0];
  },

  async create({ applicant_id, employee_code, position, base_salary, sync_source }) {
    const { rows } = await db.query(
      `INSERT INTO payroll_records (applicant_id, employee_code, position, base_salary, sync_source)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [applicant_id, employee_code, position, base_salary, sync_source ?? "ATS Direct Sync"]
    );
    return rows[0];
  },

  async update(id, { position, base_salary, status }) {
    const current = await this.getById(id);
    if (!current) return null;
    const { rows } = await db.query(
      "UPDATE payroll_records SET position = $1, base_salary = $2, status = $3 WHERE id = $4 RETURNING *",
      [position ?? current.position, base_salary ?? current.base_salary, status ?? current.status, id]
    );
    return rows[0];
  },

  async remove(id) {
    await db.query("DELETE FROM payroll_records WHERE id = $1", [id]);
  },
};

export default PayrollRecord;
