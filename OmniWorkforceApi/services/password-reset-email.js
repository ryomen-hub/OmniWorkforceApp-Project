import nodemailer from "nodemailer";

export async function sendPasswordResetEmail({ recipient, resetUrl }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from) {
    throw new Error("SMTP password-reset email is not fully configured.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: recipient,
    subject: "Reset your OmniWorkforce password",
    text: [
      "We received a request to reset your OmniWorkforce password.",
      "",
      `Use this one-time link within 30 minutes: ${resetUrl}`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  });
}
