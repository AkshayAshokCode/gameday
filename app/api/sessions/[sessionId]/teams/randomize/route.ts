import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-server";
import { createServerClient } from "@/lib/supabase/server";

// POST /api/sessions/[sessionId]/teams/randomize
// Organizer/admin-only: shuffles the actual attended pool (not just who
// voted in) into two even teams. Runs server-side because session_captains
// has no client insert policy on purpose. Clears any previous assignment
// first so re-randomizing (or a changed attendance list) doesn't leave stale
// rows for people no longer marked attended.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const db = createServerClient();

  const { data: session, error: sessionError } = await db
    .from("sessions")
    .select("id, group_id, organizer_id, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "locked" && session.status !== "completed") {
    return NextResponse.json(
      { error: "Attendance must be marked before forming teams" },
      { status: 400 }
    );
  }

  const { data: membership } = await db
    .from("group_members")
    .select("role")
    .eq("group_id", session.group_id)
    .eq("user_id", userId)
    .maybeSingle();

  const canManage = session.organizer_id === userId || membership?.role === "admin";
  if (!canManage) {
    return NextResponse.json({ error: "Only the organizer or an admin can form teams" }, { status: 403 });
  }

  const { data: attendanceRows } = await db
    .from("attendance")
    .select("user_id")
    .eq("session_id", sessionId)
    .eq("attended", true);

  const attendedIds = (attendanceRows ?? []).map((a) => a.user_id);
  if (attendedIds.length < 2) {
    return NextResponse.json({ error: "Need at least 2 attended members to form teams" }, { status: 400 });
  }

  // Fisher-Yates shuffle, then split down the middle.
  const shuffled = [...attendedIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const mid = Math.ceil(shuffled.length / 2);
  const teamA = shuffled.slice(0, mid);
  const teamB = shuffled.slice(mid);

  await db.from("session_captains").delete().eq("session_id", sessionId);

  const rows = [
    ...teamA.map((uid) => ({ session_id: sessionId, user_id: uid, team: "A" })),
    ...teamB.map((uid) => ({ session_id: sessionId, user_id: uid, team: "B" })),
  ];

  const { error: insertError } = await db.from("session_captains").insert(rows);
  if (insertError) {
    return NextResponse.json({ error: "Failed to save teams" }, { status: 500 });
  }

  await db.from("sessions").update({ team_selection_mode: "randomize" }).eq("id", sessionId);

  return NextResponse.json({ teamA: teamA.length, teamB: teamB.length });
}
