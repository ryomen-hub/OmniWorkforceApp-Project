export const LOGIN_FAILURE_LIMIT = 4;
export const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function nextLoginFailureState(failedAttempts, lockedUntil, now = new Date()) {
  const currentTime = now instanceof Date ? now : new Date(now);
  const lockExpiry = lockedUntil ? new Date(lockedUntil) : null;

  if (lockExpiry && lockExpiry > currentTime) {
    return {
      failedAttempts,
      lockedUntil: lockExpiry,
      locked: true,
    };
  }

  const nextFailedAttempts = (lockExpiry ? 0 : failedAttempts) + 1;
  const shouldLock = nextFailedAttempts >= LOGIN_FAILURE_LIMIT;

  return {
    failedAttempts: nextFailedAttempts,
    lockedUntil: shouldLock
      ? new Date(currentTime.getTime() + LOGIN_LOCKOUT_DURATION_MS)
      : null,
    locked: shouldLock,
  };
}
