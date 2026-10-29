import db from "../config/db.js";

async function getConversation(client, id, viewerId) {
  const { rows } = await client.query(
    `SELECT c.id, c.name, c.is_group, c.created_by, c.created_at, c.updated_at,
       json_agg(json_build_object('id', u.id, 'email', u.email, 'role', u.role))
         FILTER (WHERE u.id IS NOT NULL) AS members,
       (SELECT json_build_object(
          'id', m.id, 'body', m.body, 'sender_id', m.sender_id,
          'sender_email', sender.email, 'created_at', m.created_at
        )
        FROM messages m
        JOIN users sender ON sender.id = m.sender_id
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1) AS last_message,
       (SELECT COUNT(*)::int
        FROM messages unread
        WHERE unread.conversation_id = c.id
          AND unread.sender_id <> $2
          AND unread.created_at > member.last_read_at) AS unread_count
     FROM conversations c
     JOIN conversation_members member
       ON member.conversation_id = c.id AND member.user_id = $2
     JOIN conversation_members all_members ON all_members.conversation_id = c.id
     JOIN users u ON u.id = all_members.user_id
     WHERE c.id = $1
     GROUP BY c.id, member.last_read_at`,
    [id, viewerId]
  );
  return rows[0];
}

const Conversation = {
  async getColleaguesForUser(userId) {
    const { rows } = await db.query(
      `SELECT id, email, role
       FROM users
       WHERE id <> $1
       ORDER BY role, email`,
      [userId]
    );
    return rows;
  },

  async getAllForUser(userId) {
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.is_group, c.created_by, c.created_at, c.updated_at,
         json_agg(json_build_object('id', u.id, 'email', u.email, 'role', u.role))
           FILTER (WHERE u.id IS NOT NULL) AS members,
         (SELECT json_build_object(
            'id', m.id, 'body', m.body, 'sender_id', m.sender_id,
            'sender_email', sender.email, 'created_at', m.created_at
          )
          FROM messages m
          JOIN users sender ON sender.id = m.sender_id
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 1) AS last_message,
         (SELECT COUNT(*)::int
          FROM messages unread
          WHERE unread.conversation_id = c.id
            AND unread.sender_id <> $1
            AND unread.created_at > mine.last_read_at) AS unread_count
       FROM conversations c
       JOIN conversation_members mine
         ON mine.conversation_id = c.id AND mine.user_id = $1
       JOIN conversation_members all_members ON all_members.conversation_id = c.id
       JOIN users u ON u.id = all_members.user_id
       GROUP BY c.id, mine.last_read_at
       ORDER BY c.updated_at DESC`,
      [userId]
    );
    return rows;
  },

  async getForUser(id, userId) {
    return getConversation(db, id, userId);
  },

  async create({ userId, memberIds, name }) {
    const client = await db.connect();
    let transactionOpen = true;
    try {
      await client.query("BEGIN");
      const uniqueMembers = [...new Set([...memberIds.map(String), String(userId)])];
      const { rows: users } = await client.query(
        "SELECT id FROM users WHERE id = ANY($1::bigint[])",
        [uniqueMembers]
      );
      if (users.length !== uniqueMembers.length) {
        const error = new Error("One or more selected users do not exist.");
        error.status = 400;
        throw error;
      }

      const isGroup = uniqueMembers.length > 2;
      if (!isGroup) {
        const otherUserId = uniqueMembers.find((id) => id !== String(userId));
        const { rows: existing } = await client.query(
          `SELECT c.id
           FROM conversations c
           JOIN conversation_members first_member ON first_member.conversation_id = c.id
           JOIN conversation_members second_member ON second_member.conversation_id = c.id
           WHERE c.is_group = false
             AND first_member.user_id = $1
             AND second_member.user_id = $2
             AND (SELECT COUNT(*) FROM conversation_members
                  WHERE conversation_id = c.id) = 2
           LIMIT 1`,
          [userId, otherUserId]
        );
        if (existing[0]) {
          await client.query("COMMIT");
          transactionOpen = false;
          return this.getForUser(existing[0].id, userId);
        }
      } else if (!name?.trim()) {
        const error = new Error("A name is required for group conversations.");
        error.status = 400;
        throw error;
      }

      const { rows: [conversation] } = await client.query(
        "INSERT INTO conversations (name, is_group, created_by) VALUES ($1, $2, $3) RETURNING id",
        [isGroup ? name.trim() : null, isGroup, userId]
      );
      for (const memberId of uniqueMembers) {
        await client.query(
          "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)",
          [conversation.id, memberId]
        );
      }
      await client.query("COMMIT");
      transactionOpen = false;
      return this.getForUser(conversation.id, userId);
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async getMessages(id, userId) {
    const { rows: membership } = await db.query(
      "SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
      [id, userId]
    );
    if (!membership[0]) return null;
    const { rows } = await db.query(
      `SELECT messages.id, messages.conversation_id, messages.sender_id,
         messages.body, messages.created_at, users.email AS sender_email
       FROM messages
       JOIN users ON users.id = messages.sender_id
       WHERE messages.conversation_id = $1
       ORDER BY messages.created_at, messages.id`,
      [id]
    );
    return rows;
  },

  async createMessage(id, senderId, body) {
    const client = await db.connect();
    let transactionOpen = true;
    try {
      await client.query("BEGIN");
      const { rows: membership } = await client.query(
        "SELECT user_id FROM conversation_members WHERE conversation_id = $1 FOR SHARE",
        [id]
      );
      if (!membership.length || !membership.some((member) => String(member.user_id) === String(senderId))) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return null;
      }
      const { rows: [message] } = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, conversation_id, sender_id, body, created_at`,
        [id, senderId, body]
      );
      const { rows: [sender] } = await client.query(
        "SELECT email FROM users WHERE id = $1",
        [senderId]
      );
      await client.query(
        "UPDATE conversations SET updated_at = now() WHERE id = $1",
        [id]
      );
      await client.query(
        "UPDATE conversation_members SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2",
        [id, senderId]
      );
      await client.query("COMMIT");
      transactionOpen = false;
      return {
        ...message,
        sender_email: sender.email,
        member_ids: membership.map((member) => member.user_id),
      };
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async markRead(id, userId) {
    const { rows } = await db.query(
      `UPDATE conversation_members SET last_read_at = now()
       WHERE conversation_id = $1 AND user_id = $2 RETURNING conversation_id`,
      [id, userId]
    );
    return rows[0];
  },
};

export default Conversation;
