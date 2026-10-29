import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_MIN_INTERVAL_MS = 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
  };
}

export function hashPasswordResetToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetUrl(baseUrl, token) {
  const url = new URL("/", baseUrl);
  url.searchParams.set("resetToken", token);
  return url.toString();
}
