// Real-time Posts test — run with the server already running: node test-realtime-posts.js
// Connects one socket per role, fires normal HTTP requests, and checks
// which sockets actually receive the live events. Verification tool, not part of the app.
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

function listen(name, token, log) {
  return new Promise((resolve) => {
    const socket = ioClient(BASE, { auth: { token }, reconnection: false });
    for (const ev of ["post:created", "post:deleted", "post:reactions"]) {
      socket.on(ev, (data) => log.push({ who: name, ev, data }));
    }
    socket.on("connected", () => resolve(socket));
  });
}

const api = (token, method, path, body) =>
  fetch(`${BASE}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

const who = (log, ev) => log.filter((e) => e.ev === ev).map((e) => e.who).sort().join(", ") || "(nobody)";

const tokens = {
  Admin: await login("admin@omniworkforce.ph"),
  Payroll: await login("payroll@omniworkforce.ph"),
  Employee: await login("employee@omniworkforce.ph"),
  Recruitment: await login("recruitment@omniworkforce.ph"),
};

const log = [];
const sockets = [];
for (const [name, token] of Object.entries(tokens)) sockets.push(await listen(name, token, log));
console.log("4 sockets connected: Admin, Payroll, Employee, Recruitment\n");

console.log("=== 1. Payroll publishes a post (allowed) ===");
const created = await api(tokens.Payroll, "POST", "/posts", { body: "Live test announcement" });
const post = await created.json();
await wait(400);
console.log(`HTTP ${created.status} | received post:created -> ${who(log, "post:created")}`);
log.length = 0;

console.log("\n=== 2. Employee tries to post (should be blocked, no event) ===");
const blocked = await api(tokens.Employee, "POST", "/posts", { body: "should not appear" });
await wait(400);
console.log(`HTTP ${blocked.status} | received post:created -> ${who(log, "post:created")}`);
log.length = 0;

console.log("\n=== 3. Employee reacts 'like' to that post ===");
const react = await api(tokens.Employee, "POST", `/posts/${post.id}/reactions`, { type: "like" });
await wait(400);
const reactEvt = log.find((e) => e.ev === "post:reactions");
console.log(`HTTP ${react.status} | received post:reactions -> ${who(log, "post:reactions")}`);
console.log("payload:", JSON.stringify(reactEvt?.data));
log.length = 0;

console.log("\n=== 4. Employee un-reacts (toggle off) ===");
await api(tokens.Employee, "POST", `/posts/${post.id}/reactions`, { type: "like" });
await wait(400);
console.log("payload:", JSON.stringify(log.find((e) => e.ev === "post:reactions")?.data));
log.length = 0;

console.log("\n=== 5. Admin deletes the post ===");
const del = await api(tokens.Admin, "DELETE", `/posts/${post.id}`);
await wait(400);
console.log(`HTTP ${del.status} | received post:deleted -> ${who(log, "post:deleted")}`);
console.log("payload:", JSON.stringify(log.find((e) => e.ev === "post:deleted")?.data));

sockets.forEach((s) => s.close());
process.exit(0);
