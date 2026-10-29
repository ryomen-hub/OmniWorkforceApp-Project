// Socket.io connection test — run with: node test-socket.js (server must
// already be running in another terminal). Verifies the same 3 cases the
// HTTP auth middleware is tested against: no token, bad token, valid
// token. Not part of the running app — a verification tool, same idea as
// resetPassword.js.
import { io as ioClient } from "socket.io-client";

function testConnection(label, authPayload) {
  return new Promise((resolve) => {
    const socket = ioClient("http://localhost:4000", {
      auth: authPayload,
      reconnection: false,
      timeout: 3000,
    });

    const timer = setTimeout(() => {
      console.log(`${label}: TIMED OUT (no response either way)`);
      socket.close();
      resolve();
    }, 3000);

    socket.on("connect", () => {
      console.log(`${label}: CONNECTED (socket id ${socket.id})`);
    });

    socket.on("connected", (data) => {
      console.log(`${label}: received "connected" ack ->`, JSON.stringify(data.user));
      clearTimeout(timer);
      socket.close();
      resolve();
    });

    socket.on("connect_error", (err) => {
      console.log(`${label}: REJECTED — ${err.message}`);
      clearTimeout(timer);
      socket.close();
      resolve();
    });
  });
}

async function main() {
  console.log("=== Test 1: no token at all ===");
  await testConnection("No token", {});

  console.log("\n=== Test 2: garbage/invalid token ===");
  await testConnection("Bad token", { token: "this.is.not.a.real.jwt" });

  console.log("\n=== Test 3: valid token (real login first) ===");
  const loginRes = await fetch("http://localhost:4000/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@omniworkforce.ph", password: "test" }),
  });
  const { token } = await loginRes.json();
  await testConnection("Valid token (Admin)", { token });

  process.exit(0);
}

main();
