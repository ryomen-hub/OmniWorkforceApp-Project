// Real-time Notifications test — run with the server already running:
//   node test-realtime-notifications.js
// Verification tool, not part of the app.
import { io as ioClient } from "socket.io-client";

const BASE = "http://localhost:4000";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email) {
  const res = await fetch(`${BASE}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test" }),
  });
  return (await res.json()).token;
}
const api = (token, method, path, body) =>
  fetch(`${BASE}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

const tokens = {
  Admin: await login("admin@omniworkforce.ph"),
  HR: await login("hr@omniworkforce.ph"),
  Recruitment: await login("recruitment@omniworkforce.ph"),
  Payroll: await login("payroll@omniworkforce.ph"),
  Employee: await login("employee@omniworkforce.ph"),
};

const log = [];
const sockets = [];
for (const [name, token] of Object.entries(tokens)) {
  await new Promise((resolve) => {
    const s = ioClient(BASE, { auth: { token }, reconnection: false });
    s.on("notification:new", (data) => log.push({ who: name, data }));
    s.on("connected", () => { sockets.push(s); resolve(); });
  });
}
console.log("5 sockets connected: Admin, HR, Recruitment, Payroll, Employee\n");

const who = () => log.map((e) => e.who).sort().join(", ") || "(nobody)";

console.log("=== 1. Admin advances Carlos's stage (HR referred him) ===");
let r = await api(tokens.Admin, "PATCH", "/applicants/2", { bpo_status: "Operations Interview" });
await wait(400);
console.log(`HTTP ${r.status} | notification:new received by -> ${who()}`);
console.log("payload:", JSON.stringify(log[0]?.data && { title: log[0].data.title, description: log[0].data.description, is_read: log[0].data.is_read }));
log.length = 0;

console.log("\n=== 2. HR advances the applicant HR referred (own action, should not self-notify) ===");
r = await api(tokens.HR, "PATCH", "/applicants/2", { bpo_status: "Contract Signing" });
await wait(400);
console.log(`HTTP ${r.status} | received by -> ${who()}`);
log.length = 0;

console.log("\n=== 3. Admin PATCHes the same status again (no actual change) ===");
r = await api(tokens.Admin, "PATCH", "/applicants/2", { bpo_status: "Contract Signing" });
await wait(400);
console.log(`HTTP ${r.status} | received by -> ${who()}`);
log.length = 0;

console.log("\n=== 4. Admin emails the Payroll Officers department ===");
r = await api(tokens.Admin, "POST", "/emails", {
  recipient: "payroll@omniworkforce.ph", recipient_role: "Payroll Officers",
  subject: "Cutoff schedule", body: "Please confirm the cutoff dates.",
});
await wait(400);
console.log(`HTTP ${r.status} | received by -> ${who()}  (sender Admin should NOT be listed)`);
console.log("payload:", JSON.stringify(log[0]?.data && { title: log[0].data.title, description: log[0].data.description }));
log.length = 0;

console.log("\n=== 5. Saved in the database too (what someone offline finds later) ===");
for (const name of ["HR", "Payroll", "Employee"]) {
  const list = await (await api(tokens[name], "GET", "/notifications")).json();
  const fresh = list.filter((n) => ["Applicant stage updated", "New email"].includes(n.title));
  console.log(`${name}: ${fresh.length} new notification(s) ->`, fresh.map((n) => `${n.title} [unread=${!n.is_read}]`).join("; ") || "none");
}

sockets.forEach((s) => s.close());
process.exit(0);
