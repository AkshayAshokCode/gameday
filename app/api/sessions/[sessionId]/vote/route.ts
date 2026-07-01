import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-server";
import { createServerClient } from "@/lib/supabase/server";

// POST /api/sessions/[sessionId]/vote
// Body: { voted_in: boolean, guest_count?: number, guest_names?: string[] }
//
// Runs server-side because casting a vote can require coordinating two tables
// (session_votes + session_waitlist) atomically-enough for a friend-group
// scale app: if the confirmed pool is full, an "in" vote lands on the
// waitlist instead; dropping out ("in" -> "out") promotes the next waitlisted
// person. Direct client writes to session_waitlist are blocked by RLS on
// purpose (see migration 002) — this route is the only path onto it.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const body = await req.json();
  const {
    voted_in,
    guest_count = 0,
    guest_names = [],
  } = body as { voted_in: boolean; guest_count?: number; guest_names?: string[] };

  const db = createServerClient();

  const { data: session, error: sessionError } = await db
    .from("sessions")
    .select("id, group_id, max_capacity, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "open") {
    return NextResponse.json({ error: "Voting is closed for this session" }, { status: 400 });
  }

  const { data: membership } = await db
    .from("group_members")
    .select("user_id")
    .eq("group_id", session.group_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  const { data: existingWaitlist } = await db
    .from("session_waitlist")
    .select("user_id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: existingVote } = await db
    .from("session_votes")
    .select("voted_in")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  const wasConfirmed = Boolean(existingVote?.voted_in) && !existingWaitlist;

  if (!voted_in) {
    await db.from("session_votes").upsert(
      { session_id: sessionId, user_id: userId, voted_in: false, guest_count: 0, guest_names: [] },
      { onConflict: "session_id,user_id" }
    );

    if (existingWaitlist) {
      await db.from("session_waitlist").delete().eq("session_id", sessionId).eq("user_id", userId);
    }

    if (wasConfirmed) {
      await promoteNextWaitlisted(db, sessionId);
    }

    return NextResponse.json({ status: "out" });
  }

  const partySize = 1 + Math.max(0, guest_count);

  const { data: confirmedVotes } = await db
    .from("session_votes")
    .select("user_id, guest_count")
    .eq("session_id", sessionId)
    .eq("voted_in", true)
    .neq("user_id", userId);

  const { data: waitlisted } = await db
    .from("session_waitlist")
    .select("user_id")
    .eq("session_id", sessionId);

  const waitlistedIds = new Set((waitlisted ?? []).map((w) => w.user_id));
  const confirmedHeadcount = (confirmedVotes ?? [])
    .filter((v) => !waitlistedIds.has(v.user_id))
    .reduce((sum, v) => sum + 1 + v.guest_count, 0);

  await db.from("session_votes").upsert(
    { session_id: sessionId, user_id: userId, voted_in: true, guest_count, guest_names },
    { onConflict: "session_id,user_id" }
  );

  const fits = confirmedHeadcount + partySize <= session.max_capacity;

  if (fits) {
    if (existingWaitlist) {
      await db.from("session_waitlist").delete().eq("session_id", sessionId).eq("user_id", userId);
    }
    return NextResponse.json({ status: "confirmed" });
  }

  if (!existingWaitlist) {
    const { data: maxPositionRow } = await db
      .from("session_waitlist")
      .select("position")
      .eq("session_id", sessionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    await db.from("session_waitlist").insert({
      session_id: sessionId,
      user_id: userId,
      position: (maxPositionRow?.position ?? 0) + 1,
    });
  }

  return NextResponse.json({ status: "waitlisted" });
}

// Pops the earliest-position waitlisted user, making them confirmed. Simple
// FIFO — doesn't try to bin-pack party sizes against the freed capacity,
// matching the plan's "a drop-out auto-promotes the next person."
async function promoteNextWaitlisted(
  db: ReturnType<typeof createServerClient>,
  sessionId: string
) {
  const { data: next } = await db
    .from("session_waitlist")
    .select("user_id, position")
    .eq("session_id", sessionId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (next) {
    await db.from("session_waitlist").delete().eq("session_id", sessionId).eq("user_id", next.user_id);
  }
}
