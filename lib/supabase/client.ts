import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Browser client — uses the publishable key; RLS enforces per-user access.
// Pass the Supabase JWT (minted after Firebase OTP) via the Authorization header.
export function createBrowserClient(accessToken?: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    accessToken
      ? {
          global: {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        }
      : undefined
  );
}
