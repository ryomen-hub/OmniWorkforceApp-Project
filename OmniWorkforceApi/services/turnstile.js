const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export class TurnstileVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TurnstileVerificationError";
  }
}

export async function verifyTurnstile({ token, secretKey, allowedHostnames }) {
  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  let response;
  try {
    response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new TurnstileVerificationError("Could not reach the Turnstile verification service.");
  }

  if (!response.ok) {
    throw new TurnstileVerificationError("Turnstile verification service returned an error.");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new TurnstileVerificationError("Turnstile verification service returned an invalid response.");
  }

  return result.success === true
    && result.action === "login"
    && allowedHostnames.includes(result.hostname);
}
