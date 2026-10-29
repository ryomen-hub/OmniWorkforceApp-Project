import db from "../config/db.js";

const Applicant = {
  async getAll() {
    const { rows } = await db.query(
      `SELECT applicants.*, job_postings.title AS posting_title,
         job_postings.department AS posting_department
       FROM applicants
       LEFT JOIN job_postings ON job_postings.id = applicants.job_posting_id
       ORDER BY applicants.created_at DESC`
    );
    return rows;
  },

  async getById(id) {
    const { rows } = await db.query(
      `SELECT applicants.*, job_postings.title AS posting_title,
         job_postings.department AS posting_department
       FROM applicants
       LEFT JOIN job_postings ON job_postings.id = applicants.job_posting_id
       WHERE applicants.id = $1`,
      [id]
    );
    return rows[0];
  },

  async create({ name, email, job_offer, salary, referred_by, job_posting_id }) {
    const { rows } = await db.query(
      `INSERT INTO applicants (name, email, job_offer, salary, referred_by, job_posting_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, email, job_offer, salary, referred_by, job_posting_id || null]
    );
    return rows[0];
  },

  // Matches the "Advance Stage" button in the frontend
  async update(id, { bpo_status, payout_status, job_posting_id }) {
    const current = await this.getById(id);
    if (!current) return null;
    const { rows } = await db.query(
      `UPDATE applicants
       SET bpo_status = $1, payout_status = $2, job_posting_id = $3
       WHERE id = $4 RETURNING *`,
      [bpo_status ?? current.bpo_status, payout_status ?? current.payout_status,
        job_posting_id === undefined ? current.job_posting_id : job_posting_id || null, id]
    );
    return rows[0];
  },

  async remove(id) {
    await db.query("DELETE FROM applicants WHERE id = $1", [id]);
  },
};

export default Applicant;
