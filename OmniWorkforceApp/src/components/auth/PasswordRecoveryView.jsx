import { useState } from "react";
import Icon from "../shared/Icon";
import { API_BASE } from "../../config/api";

export default function PasswordRecoveryView({ token = "", onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const requestReset = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/users/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not request a password reset.");
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message || "Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitNewPassword = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/users/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not reset your password.");
      setComplete(true);
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message || "Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="loginView">
      <section className="login-card">
        <div className="login-header">
          <div className="logo-circle">
            <Icon style={{ width: 24, height: 24, color: "#fff" }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </Icon>
          </div>
          <div>
            <div className="login-title">Password Recovery</div>
            <div className="login-subtitle">OmniWorkforce Account Access</div>
          </div>
        </div>

        {!token ? (
          <form onSubmit={requestReset}>
            <p className="recovery-description">Enter your account email. If it is registered, we’ll send a password reset link.</p>
            <div className="form-group">
              <label className="form-label" htmlFor="recoveryEmail">Email</label>
              <input
                autoComplete="email"
                className="text-input"
                id="recoveryEmail"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            {message && <div className="recovery-success" role="status">{message}</div>}
            {error && <div className="login-captcha-error" role="alert">{error}</div>}
            <button className="btn-primary" disabled={submitting} type="submit">
              {submitting ? "Sending…" : "Send Reset Link"}
            </button>
            <button className="recovery-back-btn" onClick={onBack} type="button">Back to sign in</button>
          </form>
        ) : complete ? (
          <>
            <div className="recovery-success" role="status">{message}</div>
            <button className="recovery-back-btn" onClick={onBack} type="button">Back to sign in</button>
          </>
        ) : (
          <form onSubmit={submitNewPassword}>
            <p className="recovery-description">Choose a new password with at least 8 characters. This link expires after 30 minutes and can only be used once.</p>
            <div className="form-group">
              <label className="form-label" htmlFor="newPassword">New password</label>
              <input
                autoComplete="new-password"
                className="text-input"
                id="newPassword"
                minLength="8"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirmNewPassword">Confirm new password</label>
              <input
                autoComplete="new-password"
                className="text-input"
                id="confirmNewPassword"
                minLength="8"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </div>
            {error && <div className="login-captcha-error" role="alert">{error}</div>}
            <button className="btn-primary" disabled={submitting} type="submit">
              {submitting ? "Updating…" : "Reset Password"}
            </button>
            <button className="recovery-back-btn" onClick={onBack} type="button">Back to sign in</button>
          </form>
        )}
      </section>
    </div>
  );
}
