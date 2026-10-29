import Icon from "../shared/Icon";
import { useState } from "react";
import PasswordRecoveryView from "./PasswordRecoveryView";
import TurnstileWidget from "./TurnstileWidget";

// No role dropdown anymore — the account's role comes back from the
// server based on email + password, so there's nothing for the user to
// pick. See useAuth.js for where that actually happens.
export default function LoginView({
  email,
  setEmail,
  password,
  setPassword,
  handleLogin,
  captchaToken,
  setCaptchaToken,
  captchaResetSignal,
}) {
  const [showRecovery, setShowRecovery] = useState(false);
  if (showRecovery) {
    return <PasswordRecoveryView onBack={() => setShowRecovery(false)} />;
  }

  return (
    <div id="loginView">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-circle">
            <Icon style={{ width: 24, height: 24, color: "#fff" }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </Icon>
          </div>
          <div>
            <div className="login-title">OmniWorkforce</div>
            <div className="login-subtitle">Referral Force &amp; Portal Access</div>
          </div>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); handleLogin(); }}>
          <div className="form-group">
            <label className="form-label" htmlFor="emailInput">Email</label>
            <input
              type="email"
              id="emailInput"
              className="text-input"
              placeholder="e.g. admin@omniworkforce.ph"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="loginPass">Password</label>
            <input
              type="password"
              id="loginPass"
              className="text-input"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <TurnstileWidget
            token={captchaToken}
            setToken={setCaptchaToken}
            resetSignal={captchaResetSignal}
          />

          <button type="submit" className="btn-primary" disabled={!captchaToken}>
            <span>Sign In</span>
            <Icon>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </Icon>
          </button>
          <button className="recovery-back-btn" onClick={() => setShowRecovery(true)} type="button">
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
}