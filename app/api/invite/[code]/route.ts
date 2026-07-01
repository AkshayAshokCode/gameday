import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/invite/[code]
// Public preview of a group by invite code — no auth required, so a link
// recipient can see what they're joining before logging in. Runs server-side
// because RLS blocks non-members from reading a group's row.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const db = createServerClient();

  const { data: group, error } = await db
    .from("groups")
    .select("id, name, sport")
    .eq("invite_code", code)
    .single();

  if (error || !group) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json({ group });
}
