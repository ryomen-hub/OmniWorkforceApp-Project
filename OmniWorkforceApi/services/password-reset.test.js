import assert from "node:assert/strict";
import test from "node:test";
import {
  createPasswordResetToken,
  createPasswordResetUrl,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "./password-reset.js";

test("creates a unique token and stores only its deterministic hash", () => {
  const first = createPasswordResetToken();
  const second = createPasswordResetToken();

  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashPasswordResetToken(first.token));
  assert.notEqual(first.tokenHash, first.token);
  assert.equal(first.tokenHash.length, 64);
});

test("reset tokens expire after 30 minutes", () => {
  const before = Date.now();
  const { expiresAt } = createPasswordResetToken();
  const after = Date.now();

  assert.ok(expiresAt.getTime() >= before + PASSWORD_RESET_TOKEN_TTL_MS);
  assert.ok(expiresAt.getTime() <= after + PASSWORD_RESET_TOKEN_TTL_MS);
});

test("builds a reset URL with an encoded token query parameter", () => {
  const resetUrl = createPasswordResetUrl("http://localhost:5173", "token+/=");
  const parsed = new URL(resetUrl);

  assert.equal(parsed.origin, "http://localhost:5173");
  assert.equal(parsed.pathname, "/");
  assert.equal(parsed.searchParams.get("resetToken"), "token+/=");
});
