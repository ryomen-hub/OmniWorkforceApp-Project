import db from "../config/db.js";

const JobPosting = {
  async getAll() {
    const { rows } = await db.query(
      `SELECT job_postings.*,
        COUNT(applicants.id)::int AS applicant_count
       FROM job_postings
       LEFT JOIN applicants ON applicants.job_posting_id = job_postings.id
       GROUP BY job_postings.id
       ORDER BY job_postings.created_at DESC`
    );
    return rows;
  },

  async create({ title, department, description, created_by }) {
    const { rows } = await db.query(
      `INSERT INTO job_postings (title, department, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, department, description || null, created_by]
    );
    return rows[0];
  },

  async update(id, { title, department, description, status }) {
    const { rows } = await db.query(
      `UPDATE job_postings
       SET title = COALESCE($1, title),
           department = COALESCE($2, department),
           description = COALESCE($3, description),
           status = COALESCE($4, status),
           updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [title, department, description, status, id]
    );
    return rows[0];
  },

  async remove(id) {
    const { rows } = await db.query("DELETE FROM job_postings WHERE id = $1 RETURNING id", [id]);
    return rows[0];
  },
};

export default JobPosting;
