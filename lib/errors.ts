// Turns raw SDK/DB errors into something a human should see. Three tiers:
// 1. Known Firebase auth codes → hand-written messages.
// 2. Messages our own API routes wrote (already human) → passed through.
// 3. Anything technical-looking (Postgres, JWT, fetch internals) → fallback.
const AUTH_MESSAGES: Record<string, string> = {
  "auth/too-many-requests": "Too many attempts. Give it a few minutes, then try again.",
  "auth/network-request-failed": "Couldn't reach the network. Check your connection and retry.",
  "auth/operation-not-allowed": "Sign-in is temporarily unavailable. Please try again later.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup — allow popups for this site and try again.",
  "auth/account-exists-with-different-credential":
    "That email is already linked to a different sign-in method.",
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
