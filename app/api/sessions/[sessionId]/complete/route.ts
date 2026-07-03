import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-server";
import { createServerClient } from "@/lib/supabase/server";

// POST /api/sessions/[sessionId]/complete
// Organizer/admin-only: locks in attendance as final and generates one
// payment row per attended member (guests bundled into their inviting
// member's row, per the amount = cost_per_head * (1 + guest_count)).
// Runs server-side because payments has no client insert policy on purpose —
// rows are only ever created here, once, from real attendance data.
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
    .select("id, group_id, organizer_id, payment_collector_id, cost_per_head, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "locked") {
    return NextResponse.json({ error: "Session must be locked before completing" }, { status: 400 });
  }

  const { data: membership } = await db
    .from("group_members")
    .select("role")
    .eq("group_id", session.group_id)
    .eq("user_id", userId)
    .maybeSingle();

  const canManage = session.organizer_id === userId || membership?.role === "admin";
  if (!canManage) {
    return NextResponse.json({ error: "Only the organizer or an admin can complete this session" }, { status: 403 });
  }

  const { data: existingPayments } = await db
    .from("payments")
    .select("id")
    .eq("session_id", sessionId)
    .limit(1);

  if (!existingPayments || existingPayments.length === 0) {
    const { data: attendanceRows } = await db
      .from("attendance")
      .select("user_id")
      .eq("session_id", sessionId)
      .eq("attended", true);

    const attendedIds = (attendanceRows ?? []).map((a) => a.user_id);

    if (attendedIds.length > 0) {
      const { data: voteRows } = await db
        .from("session_votes")
        .select("user_id, guest_count")
        .eq("session_id", sessionId)
        .in("user_id", attendedIds);

      const guestCountByUser = new Map((voteRows ?? []).map((v) => [v.user_id, v.guest_count]));
      const collectorId = session.payment_collector_id ?? session.organizer_id;

      const paymentRows = attendedIds.map((attendeeId) => ({
        session_id: sessionId,
        payer_id: attendeeId,
        accountable_member_id: attendeeId,
        collector_id: collectorId,
        amount:
          session.cost_per_head != null
            ? session.cost_per_head * (1 + (guestCountByUser.get(attendeeId) ?? 0))
            : null,
        status: "pending",
      }));

      const { error: paymentsError } = await db.from("payments").insert(paymentRows);
      if (paymentsError) {
        return NextResponse.json({ error: "Failed to generate payments" }, { status: 500 });
      }
    }
  }

  const { error: updateError } = await db
    .from("sessions")
    .update({ status: "completed" })
    .eq("id", sessionId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to complete session" }, { status: 500 });
  }

  return NextResponse.json({ status: "completed" });
}
