import db from "./db.js";
import { initDb } from "./initDb.js";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ROLES } from "../constants/roles.js";


// Accounts come from a JSON file instead of being typed into this script, so
// real emails and passwords never live in committed source code:
//   1. $SEED_USERS_FILE if set, else
//   2. config/seed-users.local.json  (git-ignored — your real team accounts), else
//   3. config/seed-users.example.json (committed demo accounts)
function loadAccounts() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const file = [process.env.SEED_USERS_FILE, path.join(dir, "seed-users.local.json"), path.join(dir, "seed-users.example.json")]
    .filter(Boolean)
    .find((candidate) => fs.existsSync(candidate));
  if (!file) throw new Error("No seed accounts file found (expected config/seed-users.local.json or .example.json)");

  const accounts = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const role of Object.values(ROLES)) {
    const count = accounts.filter((account) => account.role === role).length;
    if (count !== 1) throw new Error(`${path.basename(file)} must contain exactly one account with role "${role}" (found ${count})`);
  }
  for (const account of accounts) {
    if (!account.email || !account.password) throw new Error(`${path.basename(file)}: every account needs an email and a password`);
  }
  console.log(`Using accounts from ${path.basename(file)}`);
  return accounts;
}

const accounts = loadAccounts();

async function seed() {
  await initDb();

  // A dedicated client (checked out from the pool) is used here instead of
  // db.query() directly, because a real transaction (BEGIN/COMMIT) needs
  // every statement to run on the SAME connection — the pool hands out a
  // different connection per query otherwise. better-sqlite3's
  // db.transaction() didn't need this distinction since it only ever had
  // one connection (the local file) to begin with.
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    for (const table of [
      "reactions",
      "notifications",
      "emails",
      "messages",
      "conversation_members",
      "conversations",
      "payslips",
      "payroll_runs",
      "posts",
      "payroll_records",
      "applicants",
      "job_postings",
      "users",
    ]) {
      await client.query(`DELETE FROM ${table}`);
    }

    // Emails are stored lowercase, so login works no matter how it's typed
    const byRole = {};
    for (const account of accounts) {
      const email = account.email.trim().toLowerCase();
      const { rows } = await client.query(
        "INSERT INTO users (email, role, password) VALUES ($1, $2, $3) RETURNING id",
        [email, account.role, bcrypt.hashSync(account.password, 10)]
      );
      byRole[account.role] = { id: rows[0].id, email };
    }
    const admin = byRole[ROLES.ADMIN];
    const hr = byRole[ROLES.RECRUITERS_HR];
    const recruitment = byRole[ROLES.RECRUITMENT];
    const payroll = byRole[ROLES.PAYROLL];
    const employee = byRole[ROLES.EMPLOYEE];

    const maria = (await client.query(
      `INSERT INTO applicants (name, email, job_offer, salary, bpo_status, payout_status, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ["Maria Santos", "maria.s@gmail.com", "Healthcare Voice", "₱28,000 / mo + Benefits",
       "Verified by Admin", "₱5,000 (Credited)", hr.id]
    )).rows[0];
    const carlos = (await client.query(
      `INSERT INTO applicants (name, email, job_offer, salary, bpo_status, payout_status, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ["Carlos Reyes", "carlos.r@yahoo.com", "Fintech Chat", "₱32,000 / mo + Night Diff",
       "Initial Interview", "Pending Cutoff", hr.id]
    )).rows[0];
    await client.query(
      `INSERT INTO applicants (name, email, job_offer, salary, bpo_status, payout_status, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ["Jasmine Tan", "jasmine.t@outlook.com", "Foundever Voice", "₱26,000 / mo",
       "Pending Application", "Pending Verification", hr.id]
    );

    await client.query(
      `INSERT INTO payroll_records (applicant_id, employee_code, position, base_salary, sync_source, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [maria.id, "EMP-8821", "Healthcare Voice Representative", "₱28,000", "ATS Direct Sync", "Auto-Synced"]
    );
    await client.query(
      `INSERT INTO payroll_records (applicant_id, employee_code, position, base_salary, sync_source, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [carlos.id, "EMP-8822", "Fintech Chat Associate", "₱32,000", "ATS Direct Sync", "Auto-Synced"]
    );

    const post1 = (await client.query(
      "INSERT INTO posts (author_id, body, image) VALUES ($1, $2, $3) RETURNING id",
      [admin.id,
       "📢 Reminder to all department heads: The mid-month payroll cutoff and referral bonus verification deadline is this coming Friday at 5:00 PM. Please ensure all applicant milestones are validated!",
       null]
    )).rows[0];
    const post2 = (await client.query(
      "INSERT INTO posts (author_id, body, image) VALUES ($1, $2, $3) RETURNING id",
      [hr.id,
       "🎉 Great news team! We successfully hit 48 new hires this month across the Healthcare Voice and Fintech Chat accounts. Keep up the amazing work with the Referral Force links!",
       "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80"]
    )).rows[0];

    await client.query("INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, $3)", [post1.id, payroll.id, "like"]);
    await client.query("INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, $3)", [post1.id, employee.id, "celebrate"]);
    await client.query("INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, $3)", [post2.id, admin.id, "like"]);
    await client.query("INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, $3)", [post2.id, recruitment.id, "celebrate"]);

    const emails = [
      [hr.id, admin.email, ROLES.ADMIN, "Monthly Headcount Report & Target Updates",
       "Please review the attached recruitment summary for the active US Telco and Healthcare accounts.", false],
      [admin.id, hr.email, ROLES.RECRUITERS_HR, "New Referral Application: Beatriz Alonzo",
       "A new applicant has submitted their application via the Referral Force link for Customer Support Voice.", true],
      [admin.id, recruitment.email, ROLES.RECRUITMENT, "New Job Posting Approved",
       "The Healthcare Voice Representative posting is now live and accepting applicants.", false],
      [admin.id, payroll.email, ROLES.PAYROLL, "Tally ERP & ATS Auto-Sync Successful",
       "14 new employee records were synchronized automatically without requiring manual re-entry.", true],
      [hr.id, employee.email, ROLES.EMPLOYEE, "Welcome to OmniWorkforce",
       "Your account is now active. Reach out to HR if you have any onboarding questions.", false],
    ];
    for (const [sender_id, recipient, recipient_role, subject, body, is_read] of emails) {
      await client.query(
        `INSERT INTO emails (sender_id, recipient, recipient_role, subject, body, folder, is_read)
         VALUES ($1, $2, $3, $4, $5, 'inbox', $6)`,
        [sender_id, recipient, recipient_role, subject, body, is_read]
      );
    }

    const notifications = [
      ["New Candidate Onboarded", "Maria Santos successfully completed Day 90 milestone."],
      ["Payroll Cutoff Reminder", "Bi-monthly payroll sync is scheduled for Friday at 5:00 PM."],
      ["New Main Board Comment", "Recruitment Lead posted a celebration update."],
    ];
    for (const [title, description] of notifications) {
      await client.query(
        "INSERT INTO notifications (user_id, title, description, is_read) VALUES ($1, $2, $3, false)",
        [admin.id, title, description]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => {
    console.log("Database seeded with demo data.");
    console.log("Accounts created (log in with the email and password from the accounts file):");
    for (const account of accounts) console.log(`  ${account.email.trim().toLowerCase().padEnd(40)} — ${account.role}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
