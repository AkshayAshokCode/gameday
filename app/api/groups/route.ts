import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-server";
import { createServerClient } from "@/lib/supabase/server";

// POST /api/groups
// Body: { name: string, sport?: string }
// Creates a group and adds the requester as its first admin.
// Runs server-side (secret key) because RLS deliberately blocks clients from
// self-assigning the 'admin' role directly (see migration 003).
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, sport } = body as { name?: string; sport?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: "Group name required" }, { status: 400 });
  }

  const db = createServerClient();

  const { data: group, error: groupError } = await db
    .from("groups")
    .insert({ name: name.trim(), sport: sport || "football", created_by: userId })
    .select()
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }

  const { error: memberError } = await db
    .from("group_members")
    .insert({ group_id: group.id, user_id: userId, role: "admin" });

  if (memberError) {
    return NextResponse.json({ error: "Failed to add creator as admin" }, { status: 500 });
  }

  return NextResponse.json({ group });
}
