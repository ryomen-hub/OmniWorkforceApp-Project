import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { TurnstileVerificationError, verifyTurnstile } from "../services/turnstile.js";
import {
  createPasswordResetToken,
  createPasswordResetUrl,
  hashPasswordResetToken,
  MIN_PASSWORD_LENGTH,
} from "../services/password-reset.js";
import { sendPasswordResetEmail } from "../services/password-reset-email.js";

export const getAll = asyncHandler(async (req, res) => {
  res.json(await User.getAll());
});

export const getOne = asyncHandler(async (req, res) => {
  const user = await User.getById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// Doubles as "login" for this project: email + password, no role picker.
export const login = asyncHandler(async (req, res) => {
  const { email, password, captchaToken } = req.body || {};
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const allowedHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (!secretKey || !allowedHostnames.length) {
    return res.status(503).json({ error: "Login CAPTCHA is not configured. Contact the system administrator." });
  }
  if (typeof captchaToken !== "string" || !captchaToken) {
    return res.status(400).json({ error: "Complete the CAPTCHA challenge before signing in." });
  }

  let captchaValid;
  try {
    captchaValid = await verifyTurnstile({
      token: captchaToken,
      secretKey,
      allowedHostnames,
    });
  } catch (error) {
    if (!(error instanceof TurnstileVerificationError)) throw error;
    console.error("Turnstile verification failed:", error.message);
    return res.status(503).json({ error: "CAPTCHA verification is temporarily unavailable. Please try again." });
  }
  if (!captchaValid) {
    return res.status(401).json({ error: "CAPTCHA verification failed. Please try again." });
  }

  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  const user = normalizedEmail ? await User.findByEmail(normalizedEmail) : null;
  const currentlyLocked = user?.locked_until && new Date(user.locked_until) > new Date();

  if (!user || currentlyLocked || typeof password !== "string" || !User.verifyPassword(password, user.password)) {
    if (user && !currentlyLocked && typeof password === "string" && password.length > 0) {
      await User.recordFailedLogin(normalizedEmail);
    }
    return res.status(401).json({
      error: "Invalid email or password. If you have made several attempts, wait 15 minutes before trying again.",
    });
  }

  await User.clearFailedLogins(user.id);
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );

  const {
    password: _omit,
    failed_login_attempts: _omitFailedAttempts,
    locked_until: _omitLockedUntil,
    ...safeUser
  } = user;
  res.json({ token, user: safeUser });
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const genericResponse = {
    message: "If an account exists for that email, a password reset link will be sent shortly.",
  };
  if (!email) return res.json(genericResponse);

  const reset = createPasswordResetToken();
  const user = await User.createPasswordResetToken(email, reset.tokenHash, reset.expiresAt);
  if (!user) return res.json(genericResponse);

  const baseUrl = process.env.PASSWORD_RESET_URL;
  if (!baseUrl) {
    console.error("Password reset email failed: PASSWORD_RESET_URL is not configured.");
    return res.json(genericResponse);
  }

  try {
    const resetUrl = createPasswordResetUrl(baseUrl, reset.token);
    sendPasswordResetEmail({ recipient: user.email, resetUrl })
      .catch((error) => console.error("Password reset email delivery failed:", error));
  } catch (error) {
    console.error("Password reset email setup failed:", error);
  }

  res.json(genericResponse);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== "string" || !token || typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `A valid reset token and a password of at least ${MIN_PASSWORD_LENGTH} characters are required.` });
  }

  const reset = await User.resetPasswordWithToken(hashPasswordResetToken(token), password);
  if (!reset) {
    return res.status(400).json({ error: "This password reset link is invalid or expired. Request a new one." });
  }
  res.json({ message: "Password reset successfully. You can now sign in." });
});

// Admin Office only (enforced in the route, not here — see users.routes.js)
export const create = asyncHandler(async (req, res) => {
  const { email, role, password } = req.body;
  if (!email || !role || !password) {
    return res.status(400).json({ error: "email, role, and password are required" });
  }
  res.status(201).json(await User.create({ email, role, password }));
});

export const update = asyncHandler(async (req, res) => {
  const updated = await User.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "User not found" });
  res.json(updated);
});

export const changePassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: "password must be at least 4 characters" });
  }
  const updated = await User.updatePassword(req.params.id, password);
  if (!updated) return res.status(404).json({ error: "User not found" });
  res.json({ message: "Password updated." });
});

export const remove = asyncHandler(async (req, res) => {
  await User.remove(req.params.id);
  res.status(204).end();
});
