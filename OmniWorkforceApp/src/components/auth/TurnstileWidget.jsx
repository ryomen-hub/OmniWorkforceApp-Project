import { useEffect, useRef, useState } from "react";

const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function TurnstileWidget({ token, setToken, resetSignal }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [status, setStatus] = useState("Loading CAPTCHA…");
  const [error, setError] = useState("");
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

  useEffect(() => {
    if (!siteKey) {
      setStatus("");
      setError("CAPTCHA is not configured. Contact the system administrator.");
      return undefined;
    }

    let disposed = false;
    let script = document.querySelector('script[data-turnstile-script="true"]');

    const renderWidget = () => {
      if (disposed || !containerRef.current || !window.turnstile) return;
      setError("");
      setStatus("");
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: "login",
        theme: "light",
        callback: (challengeToken) => {
          setToken(challengeToken);
          setError("");
        },
        "expired-callback": () => {
          setToken("");
          setError("CAPTCHA expired. Complete the challenge again.");
        },
        "error-callback": () => {
          setToken("");
          setError("CAPTCHA could not load. Check your connection and retry.");
          return true;
        },
      });
    };

    const onScriptLoad = () => {
      if (script) script.dataset.loaded = "true";
      renderWidget();
      if (!window.turnstile) {
        setError("CAPTCHA could not initialize. Check the site key and try again.");
      }
    };
    const onScriptError = () => setError("CAPTCHA could not load. Check your connection and retry.");

    if (window.turnstile) {
      renderWidget();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.dataset.turnstileScript = "true";
        document.head.appendChild(script);
      }

      if (script.dataset.loaded === "true") {
        onScriptLoad();
      } else {
        script.addEventListener("load", onScriptLoad);
        script.addEventListener("error", onScriptError);
      }
    }

    return () => {
      disposed = true;
      script?.removeEventListener("load", onScriptLoad);
      script?.removeEventListener("error", onScriptError);
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, setToken]);

  useEffect(() => {
    if (!resetSignal || widgetIdRef.current === null || !window.turnstile) return;
    setToken("");
    setError("");
    window.turnstile.reset(widgetIdRef.current);
  }, [resetSignal, setToken]);

  return (
    <div className="form-group login-captcha-group">
      <span className="form-label">Security check</span>
      <div className="login-captcha-widget" ref={containerRef} />
      {status && <div className="login-captcha-message" role="status">{status}</div>}
      {error && <div className="login-captcha-error" role="alert">{error}</div>}
      {!error && token && <div className="login-captcha-success" role="status">CAPTCHA completed.</div>}
    </div>
  );
}
