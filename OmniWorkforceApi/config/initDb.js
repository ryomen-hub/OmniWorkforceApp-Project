import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Now reads supabase-schema.sql (Postgres) instead of the old schema.sql
// (SQLite) — the SQLite one is no longer used by any code, kept only as
// a historical reference of the pre-migration schema.
export async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, "supabase-schema.sql"), "utf8");
  // pg's .query() can run a whole multi-statement SQL string in one call,
  // same as better-sqlite3's .exec() did — no per-statement looping needed.
  await db.query(schema);
  console.log("Database tables ready.");
}
