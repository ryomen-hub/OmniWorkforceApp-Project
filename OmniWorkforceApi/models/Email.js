import db from "../config/db.js";

// Every list query also pulls the sender's address — the inbox needs to
// show who a message is FROM, and the emails table only stores sender_id.
const WITH_SENDER = `SELECT emails.*, users.email AS sender_email
  FROM emails LEFT JOIN users ON users.id = emails.sender_id`;

const Email = {
  // Inbox = everything addressed to the viewer's department.
  // Sent  = everything the viewer wrote.
  // Neither filters on the `folder` column any more. It used to
  // (folder = 'inbox' for the inbox), but a freshly sent email is stored
  // once with folder = 'sent', so it could never match the recipient's
  // inbox query — mail you sent to a department never showed up there.
  async getInbox(recipientRole) {
    const { rows } = await db.query(
      `${WITH_SENDER} WHERE emails.recipient_role = $1 ORDER BY emails.created_at DESC`,
      [recipientRole]
    );
    return rows;
  },

  async getSent(senderId) {
    const { rows } = await db.query(
      `${WITH_SENDER} WHERE emails.sender_id = $1 ORDER BY emails.created_at DESC`,
      [senderId]
    );
    return rows;
  },

  async getById(id) {
    const { rows } = await db.query("SELECT * FROM emails WHERE id = $1", [id]);
    return rows[0];
  },

  async create({ sender_id, recipient, recipient_role, subject, body, folder }) {
    const { rows } = await db.query(
      `INSERT INTO emails (sender_id, recipient, recipient_role, subject, body, folder, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING *`,
      [sender_id, recipient, recipient_role, subject, body, folder ?? "sent"]
    );
    return rows[0];
  },

  // Ownership is part of the query itself: only mail addressed to the
  // viewer's own department can be marked read. Before, any logged-in user
  // could mark any email read just by guessing its id.
  async markRead(id, recipientRole) {
    const { rows } = await db.query(
      "UPDATE emails SET is_read = true WHERE id = $1 AND recipient_role = $2 RETURNING *",
      [id, recipientRole]
    );
    return rows[0];
  },

  // Same idea: you can only delete mail you can already see (you sent it,
  // or it's in your department's inbox). Returns whether anything was deleted.
  // Known limitation: an email is ONE shared row, so deleting it removes it
  // for the other side too. Per-person mailboxes would fix that.
  async remove(id, userId, recipientRole) {
    const { rowCount } = await db.query(
      "DELETE FROM emails WHERE id = $1 AND (sender_id = $2 OR recipient_role = $3)",
      [id, userId, recipientRole]
    );
    return rowCount > 0;
  },
};

export default Email;
