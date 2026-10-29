// One-off recovery script — run with: node resetPassword.js <email> <new_password>
// Bypasses login entirely (direct DB access), for exactly the situation
// where you're locked out of every account. Delete this file once you're
// done — it shouldn't ship as part of the real project.
import User from "./models/User.js";

const [, , email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.log("Usage: node resetPassword.js <email> <new_password>");
  process.exit(1);
}

async function run() {
  const user = await User.findByEmail(email);
  if (!user) {
    console.log(`No user found with email ${email}`);
    process.exit(1);
  }

  await User.updatePassword(user.id, newPassword);
  console.log(`Password for ${email} (${user.role}) reset successfully.`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
