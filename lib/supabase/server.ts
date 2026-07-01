import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Server client with the service role key — bypasses RLS.
// Used only in API routes for operations that legitimately need elevated access
// (e.g. creating a user row during the auth exchange, managing the waitlist).
// No Database generic here: partial `.select()` inference doesn't work with
// hand-written types; the DB schema enforces correctness at the SQL level.
export function createServerClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Server client that acts AS a specific user — passes a minted JWT so RLS
// policies apply as if this is a normal authenticated request.
export function createAuthedServerClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
