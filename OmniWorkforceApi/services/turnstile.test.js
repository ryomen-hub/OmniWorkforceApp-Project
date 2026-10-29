import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { TurnstileVerificationError, verifyTurnstile } from "./turnstile.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function options(overrides = {}) {
  return {
    token: "challenge-token",
    secretKey: "test-secret",
    allowedHostnames: ["localhost"],
    ...overrides,
  };
}

test("verifies a successful login challenge for an allowed hostname", async () => {
  globalThis.fetch = async (url, request) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(request.method, "POST");
    assert.equal(request.body.get("secret"), "test-secret");
    assert.equal(request.body.get("response"), "challenge-token");
    return Response.json({ success: true, action: "login", hostname: "localhost" });
  };

  assert.equal(await verifyTurnstile(options()), true);
});

test("rejects failed challenges, unexpected actions, and unapproved hostnames", async (context) => {
  const results = [
    { success: false, action: "login", hostname: "localhost" },
    { success: true, action: "password-reset", hostname: "localhost" },
    { success: true, action: "login", hostname: "attacker.example" },
  ];

  for (const result of results) {
    await context.test(JSON.stringify(result), async () => {
      globalThis.fetch = async () => Response.json(result);
      assert.equal(await verifyTurnstile(options()), false);
    });
  }
});

test("reports an unavailable verification service", async () => {
  globalThis.fetch = async () => new Response(null, { status: 502 });
  await assert.rejects(
    verifyTurnstile(options()),
    TurnstileVerificationError
  );
});

test("reports a network failure", async () => {
  globalThis.fetch = async () => {
    throw new Error("network error");
  };
  await assert.rejects(
    verifyTurnstile(options()),
    TurnstileVerificationError
  );
});
