import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-server";
import { createServerClient } from "@/lib/supabase/server";

// POST /api/sessions/[sessionId]/teams/randomize
// Organizer/admin-only: shuffles the confirmed (voted in, non-waitlisted)
// pool into two even teams. Deliberately keyed off votes rather than
// attendance — squads are usually decided before anyone reaches the turf,
// while attendance can only be marked once people actually show up. Each
// guest gets its own independent slot in the shuffle (not bundled with their
// inviting member) since headcount/capacity/payments already treat a guest
// as a real player — bundling them would let one member's +2 unbalance the
// teams. Runs server-side because session_captains has no client insert
// policy on purpose. Clears any previous assignment first so re-randomizing
// doesn't leave stale rows.
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
      { error: "Close the poll before forming teams" },
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

  const [{ data: voteRows }, { data: waitlistRows }] = await Promise.all([
    db
      .from("session_votes")
      .select("user_id, guest_count, guest_names")
      .eq("session_id", sessionId)
      .eq("voted_in", true),
    db.from("session_waitlist").select("user_id").eq("session_id", sessionId),
  ]);

  const waitlistedIds = new Set((waitlistRows ?? []).map((w) => w.user_id));
  const confirmedVotes = (voteRows ?? []).filter((v) => !waitlistedIds.has(v.user_id));

  type Slot = { userId: string; guestName: null; invitedBy: null } | { userId: null; guestName: string; invitedBy: string };
  const slots: Slot[] = [];
  for (const v of confirmedVotes) {
    slots.push({ userId: v.user_id, guestName: null, invitedBy: null });
    for (let i = 0; i < (v.guest_count ?? 0); i++) {
      slots.push({ userId: null, guestName: v.guest_names?.[i] ?? `Guest ${i + 1}`, invitedBy: v.user_id });
    }
  }

  if (slots.length < 2) {
    return NextResponse.json({ error: "Need at least 2 confirmed players to form teams" }, { status: 400 });
  }

  // Fisher-Yates shuffle, then split down the middle.
  const shuffled = [...slots];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const mid = Math.ceil(shuffled.length / 2);
  const teamA = shuffled.slice(0, mid);
  const teamB = shuffled.slice(mid);

  await db.from("session_captains").delete().eq("session_id", sessionId);

  const rows = [
    ...teamA.map((s) => ({ session_id: sessionId, user_id: s.userId, guest_name: s.guestName, invited_by: s.invitedBy, team: "A" })),
    ...teamB.map((s) => ({ session_id: sessionId, user_id: s.userId, guest_name: s.guestName, invited_by: s.invitedBy, team: "B" })),
  ];

  const { error: insertError } = await db.from("session_captains").insert(rows);
  if (insertError) {
    return NextResponse.json({ error: "Failed to save teams" }, { status: 500 });
  }

  await db.from("sessions").update({ team_selection_mode: "randomize" }).eq("id", sessionId);

  return NextResponse.json({ teamA: teamA.length, teamB: teamB.length });
}
