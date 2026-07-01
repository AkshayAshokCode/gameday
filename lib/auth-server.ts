import { NextRequest } from "next/server";
import { verify } from "jsonwebtoken";

// Extracts the user id ('sub' claim) from the Supabase-compatible JWT minted
// during the auth exchange. Returns null if missing/invalid — callers should
// respond 401 in that case.
export function getUserId(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length);
  try {
    const decoded = verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string };
    return decoded.sub;
  } catch {
    return null;
  }
}
