import db from "../config/db.js";

const REACTION_TYPES = ["like", "celebrate", "insightful"];

const Post = {
  // viewerId is optional — pass the logged-in user's id to also get back
  // whether *that* user has reacted to each post.
  async getAll(viewerId) {
    const { rows: posts } = await db.query(
      `SELECT posts.*, users.email AS author_email, users.role AS author_role
       FROM posts
       LEFT JOIN users ON users.id = posts.author_id
       ORDER BY posts.created_at DESC`
    );

    const { rows: reactionCounts } = await db.query(
      "SELECT post_id, type, COUNT(*) AS count FROM reactions GROUP BY post_id, type"
    );

    let viewerReactions = [];
    if (viewerId) {
      const result = await db.query("SELECT post_id, type FROM reactions WHERE user_id = $1", [viewerId]);
      viewerReactions = result.rows;
    }

    return posts.map((post) => {
      const reactions = {};
      for (const type of REACTION_TYPES) reactions[type] = { count: 0, reacted: false };
      for (const row of reactionCounts) {
        if (row.post_id === post.id) {
          // Postgres COUNT(*) comes back as a BIGINT, which the pg driver
          // returns as a STRING (not a number) to avoid silent precision
          // loss on huge counts. Needs an explicit Number() conversion —
          // better-sqlite3 never had this quirk, it just returned a real number.
          reactions[row.type].count = Number(row.count);
        }
      }
      for (const row of viewerReactions) {
        if (row.post_id === post.id) reactions[row.type].reacted = true;
      }
      return { ...post, reactions };
    });
  },

  async create({ author_id, body, image }) {
    const { rows } = await db.query(
      "INSERT INTO posts (author_id, body, image) VALUES ($1, $2, $3) RETURNING id",
      [author_id, body, image ?? null]
    );
    return rows[0].id;
  },

  async remove(id) {
    await db.query("DELETE FROM posts WHERE id = $1", [id]);
  },

  // Toggles a reaction on/off for a given user + post + type
  // Counts only, for one post. Used for live updates: one broadcast goes to
  // everyone, so it can't include "did *you* react" (that differs per
  // person) — each client keeps its own reacted flag from its own request.
  async getReactionCounts(postId) {
    const { rows } = await db.query(
      "SELECT type, COUNT(*) AS count FROM reactions WHERE post_id = $1 GROUP BY type",
      [postId]
    );
    const counts = {};
    for (const type of REACTION_TYPES) counts[type] = 0;
    for (const row of rows) counts[row.type] = Number(row.count);
    return counts;
  },

  async toggleReaction(postId, userId, type) {
    if (!REACTION_TYPES.includes(type)) {
      throw new Error(`Invalid reaction type: ${type}`);
    }
    const { rows } = await db.query(
      "SELECT id FROM reactions WHERE post_id = $1 AND user_id = $2 AND type = $3",
      [postId, userId, type]
    );
    if (rows[0]) {
      await db.query("DELETE FROM reactions WHERE id = $1", [rows[0].id]);
      return { reacted: false };
    }
    await db.query("INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, $3)", [postId, userId, type]);
    return { reacted: true };
  },
};

export default Post;
