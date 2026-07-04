// Turns raw SDK/DB errors into something a human should see. Three tiers:
// 1. Known Firebase auth codes → hand-written messages.
// 2. Messages our own API routes wrote (already human) → passed through.
// 3. Anything technical-looking (Postgres, JWT, fetch internals) → fallback.
const AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-phone-number": "That phone number doesn't look right — check the 10 digits.",
  "auth/missing-phone-number": "Enter your phone number first.",
  "auth/too-many-requests": "Too many attempts. Give it a few minutes, then try again.",
  "auth/invalid-verification-code": "That code didn't match. Check the SMS and try again.",
  "auth/code-expired": "That code has expired — request a new one.",
  "auth/network-request-failed": "Couldn't reach the network. Check your connection and retry.",
  "auth/operation-not-allowed": "Sign-in is temporarily unavailable. Please try again later.",
  "auth/captcha-check-failed": "Human check failed — refresh the page and try again.",
  "auth/quota-exceeded": "SMS limit reached for now. Try again in a while.",
  "auth/user-disabled": "This account has been disabled.",
};

const TECHY =
  /firebase|auth\/|pgrst|jwt|violates|constraint|duplicate key|relation |column |schema cache|fetch failed|networkerror|unexpected token|not valid json/i;

export function friendlyError(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string } | null;

  if (e?.code && AUTH_MESSAGES[e.code]) return AUTH_MESSAGES[e.code];

  const msg = e?.message ?? "";
  // Firebase often buries the code in the message: "Firebase: … (auth/xyz)."
  const embedded = msg.match(/\(auth\/([a-z-]+)\)/i);
  if (embedded) {
    const mapped = AUTH_MESSAGES[`auth/${embedded[1].toLowerCase()}`];
    if (mapped) return mapped;
  }

  if (msg && !TECHY.test(msg)) return msg;
  return fallback;
}
