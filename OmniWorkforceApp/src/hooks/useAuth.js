import { useMemo, useState } from "react";

const API_BASE = "http://localhost:4000/api";

// Login is email + password now — no role dropdown. The role comes back
// from whatever's on the account record the server finds by that email;
// the client never chooses it.
export default function useAuth(showToast, onLogin) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [role, setRole] = useState("");
  const [loggedInEmail, setLoggedInEmail] = useState("");
  const [token, setToken] = useState(null);

  const handleLogin = async () => {
    if (!email || !password) return;
    if (!captchaToken) {
      showToast("Complete the CAPTCHA challenge before signing in.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, captchaToken }),
      });

      setCaptchaToken("");
      setCaptchaResetSignal((signal) => signal + 1);
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        showToast(error || "Login failed.");
        return;
      }

      const { token: newToken, user } = await res.json();

      setToken(newToken);
      setRole(user.role);
      setLoggedInEmail(user.email);
      setLoggedIn(true);
      onLogin(user.role);
      showToast(`Welcome back — signed in as ${user.role}.`);
    } catch (err) {
      setCaptchaToken("");
      setCaptchaResetSignal((signal) => signal + 1);
      showToast("Could not reach the server. Is the backend running?");
    }
  };

  const logout = () => {
    setLoggedIn(false);
    setEmail("");
    setPassword("");
    setCaptchaToken("");
    setRole("");
    setLoggedInEmail("");
    setToken(null);
  };

  // Spread into any fetch() call from another hook that needs to hit a
  // protected route, e.g.: fetch(url, { headers: { ...auth.authHeader } })
  // useMemo matters here: without it, this would be a brand-new object on every
  // render, and any hook that lists authHeader in a dependency array (the data-loading
  // effects do) would re-run every render — an endless fetch loop.
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  return {
    loggedIn, email, setEmail, password, setPassword,
    role, loggedInEmail, token, authHeader,
    captchaToken, setCaptchaToken, captchaResetSignal,
    handleLogin, logout,
  };
}