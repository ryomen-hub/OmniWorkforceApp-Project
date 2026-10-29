import db from "../config/db.js";

const Notification = {
  async getByUser(userId) {
    const { rows } = await db.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    return rows;
  },

  async create({ user_id, title, description }) {
    const { rows } = await db.query(
      "INSERT INTO notifications (user_id, title, description) VALUES ($1, $2, $3) RETURNING *",
      [user_id, title, description]
    );
    return rows[0];
  },

  // One notification row per user who has this role, optionally skipping
  // one user (the person who caused the event — nobody needs to be
  // notified about their own action). Returns every row created.
  async createForRole(role, title, description, excludeUserId) {
    const { rows } = await db.query(
      `INSERT INTO notifications (user_id, title, description)
       SELECT id, $2, $3 FROM users
       WHERE role = $1 AND ($4::bigint IS NULL OR id <> $4::bigint)
       RETURNING *`,
      [role, title, description, excludeUserId ?? null]
    );
    return rows;
  },

  async markRead(id) {
    const { rows } = await db.query("UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *", [id]);
    return rows[0];
  },

  async markAllRead(userId) {
    await db.query("UPDATE notifications SET is_read = true WHERE user_id = $1", [userId]);
    return this.getByUser(userId);
  },

  async remove(id) {
    await db.query("DELETE FROM notifications WHERE id = $1", [id]);
  },
};

export default Notification;
