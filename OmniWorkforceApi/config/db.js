import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// DATABASE_URL comes from Supabase: Project → Settings → Database →
// Connection string → URI. It looks like:
//   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxx.supabase.co:5432/postgres
//
// Supabase requires SSL for its hosted connections; a local Postgres
// (like the one used to test this file) doesn't. Checking the connection
// string for "supabase.co" is a simple way to turn SSL on only when it's
// actually needed, without a separate environment variable to manage.
const isSupabase = process.env.DATABASE_URL?.includes("supabase.co");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isSupabase ? { rejectUnauthorized: false } : false,
});

// A pool hands out connections as needed rather than holding one open for
// the whole app's lifetime — the right pattern for a server handling
// multiple requests at once (unlike better-sqlite3's single persistent
// connection, which worked fine for a local file but isn't how a real
// network database connection should be managed).
pool.on("error", (err) => {
  console.error("Unexpected error on an idle Postgres client:", err);
});

export default pool;
