import assert from "node:assert/strict";
import test from "node:test";
import {
  LOGIN_FAILURE_LIMIT,
  LOGIN_LOCKOUT_DURATION_MS,
  nextLoginFailureState,
} from "./login-lockout.js";

test("locks the account after four consecutive incorrect passwords", () => {
  const now = new Date("2026-10-21T00:00:00.000Z");
  let state = { failedAttempts: 0, lockedUntil: null };

  for (let attempt = 1; attempt <= LOGIN_FAILURE_LIMIT; attempt += 1) {
    state = nextLoginFailureState(state.failedAttempts, state.lockedUntil, now);
    assert.equal(state.failedAttempts, attempt);
    assert.equal(state.locked, attempt === LOGIN_FAILURE_LIMIT);
  }

  assert.equal(state.lockedUntil.getTime(), now.getTime() + LOGIN_LOCKOUT_DURATION_MS);
});

test("does not extend or count attempts during an active lockout", () => {
  const now = new Date("2026-10-21T00:00:00.000Z");
  const lockedUntil = new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS);

  assert.deepEqual(
    nextLoginFailureState(LOGIN_FAILURE_LIMIT, lockedUntil, now),
    { failedAttempts: LOGIN_FAILURE_LIMIT, lockedUntil, locked: true }
  );
});

test("starts a fresh count after the lockout expires", () => {
  const now = new Date("2026-10-21T00:00:00.000Z");
  const expiredLock = new Date(now.getTime() - 1);

  assert.deepEqual(
    nextLoginFailureState(LOGIN_FAILURE_LIMIT, expiredLock, now),
    { failedAttempts: 1, lockedUntil: null, locked: false }
  );
});
