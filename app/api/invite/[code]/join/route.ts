import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-server";
import { createServerClient } from "@/lib/supabase/server";

// POST /api/invite/[code]/join
// Joins the requester into the group as 'member'. Idempotent — joining a
// group you're already in just returns it. Runs server-side so a non-member
// can look up the group by invite code (RLS blocks that for clients).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const db = createServerClient();

  const { data: group, error: groupError } = await db
    .from("groups")
    .select("id, name")
    .eq("invite_code", code)
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const { data: existing } = await db
    .from("group_members")
    .select("group_id")
    .eq("group_id", group.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    const { error: joinError } = await db
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId, role: "member" });

    if (joinError) {
      return NextResponse.json({ error: "Failed to join group" }, { status: 500 });
    }
  }

  return NextResponse.json({ group });
}
