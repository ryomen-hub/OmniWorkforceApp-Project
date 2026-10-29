import db from "../config/db.js";
import bcrypt from "bcryptjs";
import { nextLoginFailureState } from "../services/login-lockout.js";
import { PASSWORD_RESET_MIN_INTERVAL_MS } from "../services/password-reset.js";

const User = {
  async getAll() {
    const { rows } = await db.query("SELECT id, email, role, created_at FROM users");
    return rows;
  },

  async getById(id) {
    const { rows } = await db.query("SELECT id, email, role, created_at FROM users WHERE id = $1", [id]);
    return rows[0];
  },

  // Replaces findByEmployeeId — this is now the login lookup.
  // Selects * (including the password hash) since this is the one place
  // that actually needs to compare it — every other method deliberately
  // excludes the password column from what it returns.
  async findByEmail(email) {
    const { rows } = await db.query("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
    return rows[0];
  },

  async createPasswordResetToken(email, tokenHash, expiresAt) {
    const client = await db.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const { rows: [user] } = await client.query(
        `SELECT users.id, users.email,
           EXISTS (
             SELECT 1 FROM password_reset_tokens
             WHERE password_reset_tokens.user_id = users.id
               AND password_reset_tokens.created_at >
                 now() - ($2::bigint * interval '1 millisecond')
           ) AS recently_requested
         FROM users
         WHERE lower(users.email) = lower($1)
         FOR UPDATE`,
        [email, PASSWORD_RESET_MIN_INTERVAL_MS]
      );
      if (!user || user.recently_requested) {
        await client.query("COMMIT");
        transactionOpen = false;
        return null;
      }

      await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [user.id]);
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );
      await client.query("COMMIT");
      transactionOpen = false;
      return { id: user.id, email: user.email };
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async resetPasswordWithToken(tokenHash, newPassword) {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const client = await db.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const { rows: [reset] } = await client.query(
        `SELECT user_id FROM password_reset_tokens
         WHERE token_hash = $1 AND expires_at > now()
         FOR UPDATE`,
        [tokenHash]
      );
      if (!reset) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return false;
      }

      await client.query(
        `UPDATE users
         SET password = $1, failed_login_attempts = 0, locked_until = NULL
         WHERE id = $2`,
        [hashedPassword, reset.user_id]
      );
      await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [reset.user_id]);
      await client.query("COMMIT");
      transactionOpen = false;
      return true;
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async recordFailedLogin(email) {
    const client = await db.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const { rows: [user] } = await client.query(
        `SELECT id, failed_login_attempts, locked_until, now() AS database_now
         FROM users
         WHERE lower(email) = lower($1)
         FOR UPDATE`,
        [email]
      );
      if (!user) {
        await client.query("COMMIT");
        transactionOpen = false;
        return { locked: false };
      }

      const state = nextLoginFailureState(
        user.failed_login_attempts,
        user.locked_until,
        user.database_now
      );
      if (!state.locked || !user.locked_until || new Date(user.locked_until) <= new Date(user.database_now)) {
        await client.query(
          `UPDATE users
           SET failed_login_attempts = $1, locked_until = $2
           WHERE id = $3`,
          [state.failedAttempts, state.lockedUntil, user.id]
        );
      }
      await client.query("COMMIT");
      transactionOpen = false;
      return { locked: state.locked };
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async clearFailedLogins(id) {
    await db.query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1",
      [id]
    );
  },

  async create({ email, role, password }) {
    const hashed = bcrypt.hashSync(password, 10);
    const { rows } = await db.query(
      "INSERT INTO users (email, role, password) VALUES ($1, $2, $3) RETURNING id, email, role, created_at",
      [String(email).trim().toLowerCase(), role, hashed]
    );
    return rows[0];
  },

  verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  },

  async update(id, { role }) {
    const { rows } = await db.query(
      "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role, created_at",
      [role, id]
    );
    return rows[0];
  },

  // Deliberately separate from update() above — password changes are a
  // more sensitive action than an ordinary field edit, so they get their
  // own explicit function (and, in the route, their own explicit check)
  // rather than riding along with a generic "update whatever's in the body."
  async updatePassword(id, newPassword) {
    const hashed = bcrypt.hashSync(newPassword, 10);
    const { rows } = await db.query(
      `UPDATE users SET password = $1, failed_login_attempts = 0, locked_until = NULL
       WHERE id = $2 RETURNING id, email, role, created_at`,
      [hashed, id]
    );
    return rows[0];
  },

  async remove(id) {
    await db.query("DELETE FROM users WHERE id = $1", [id]);
  },
};

export default User;
