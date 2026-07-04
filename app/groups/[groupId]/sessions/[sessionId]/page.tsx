"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import { useAuth, useSupabase } from "@/lib/auth-context";
import { buildUpiLink, generateUpiQr } from "@/lib/upi";
import { CountUp } from "@/components/CountUp";
import { HoldToConfirm } from "@/components/HoldToConfirm";
import { NeoPopButton } from "@/components/NeoPopButton";
import { NumberStepper } from "@/components/NumberStepper";
import { SquadRevealOverlay } from "@/components/SquadReveal";
import { TimeRangeSelect } from "@/components/TimeRangeSelect";
import { TurfSelect } from "@/components/TurfSelect";
import { useVoteCeremony } from "@/components/VoteCeremony";
import { friendlyError } from "@/lib/errors";
import { sportEmoji } from "@/lib/sports";

interface SessionDetail {
  id: string;
  group_id: string;
  organizer_id: string | null;
  payment_collector_id: string | null;
  turf_id: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  max_capacity: number;
  status: string;
  cost_per_head: number | null;
  sport: string | null;
  turfs: { name: string; lat: number | null; lng: number | null } | null;
}

interface TurfOption {
  id: string;
  name: string;
}

interface DayOptionRow {
  id: string;
  scheduled_at: string;
  ends_at: string | null;
}

function formatTimeRange(start: string, end: string | null) {
  const startLabel = new Date(start).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!end) return startLabel;
  const endLabel = new Date(end).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startLabel} – ${endLabel}`;
}

interface DayVoteRow {
  day_option_id: string;
  user_id: string;
}

interface VoteRow {
  user_id: string;
  voted_in: boolean;
  guest_count: number;
  guest_names: string[];
  users: { name: string } | null;
}

interface WaitlistRow {
  user_id: string;
  position: number;
  users: { name: string } | null;
}

interface AttendanceRow {
  user_id: string;
  attended: boolean;
}

interface PaymentRow {
  id: string;
  payer_id: string;
  amount: number | null;
  status: string;
  payer: { name: string } | null;
}

interface GroupMemberOption {
  user_id: string;
  users: { name: string } | null;
}

interface TeamRow {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  team: string;
  users: { name: string } | null;
}

// Shared quiet-zone form styling (dark inputs, floodlight focus).
const inputCls =
  "rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none";
const eyebrowCls = "font-mono text-[11px] uppercase tracking-widest text-chalk-dim";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function SessionPage() {
  const { groupId, sessionId } = useParams<{ groupId: string; sessionId: string }>();
  const router = useRouter();
  const { user, accessToken, isLoading } = useAuth();
  const supabase = useSupabase();
  const { fire: fireCeremony, overlay: ceremonyOverlay } = useVoteCeremony();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // Raw text, not number — see maxCapacityInput in the new-session page for why.
  const [guestCountInput, setGuestCountInput] = useState("0");
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [voteAction, setVoteAction] = useState<"in" | "out" | null>(null);
  const [error, setError] = useState("");
  const [turfOptions, setTurfOptions] = useState<TurfOption[]>([]);
  const [groupTurfIds, setGroupTurfIds] = useState<string[]>([]);
  const [groupSport, setGroupSport] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState(false);
  const [editTurfId, setEditTurfId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  // Raw text, not number — see maxCapacityInput in the new-session page for why.
  const [editMaxCapacity, setEditMaxCapacity] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [dayOptions, setDayOptions] = useState<DayOptionRow[]>([]);
  const [dayVotes, setDayVotes] = useState<DayVoteRow[]>([]);
  const [dayVoting, setDayVoting] = useState(false);
  const [finalizeChoice, setFinalizeChoice] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [groupMemberCount, setGroupMemberCount] = useState(0);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [costPerHeadInput, setCostPerHeadInput] = useState("");
  const [groupMembersForCollector, setGroupMembersForCollector] = useState<GroupMemberOption[]>([]);
  const [settingCollector, setSettingCollector] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState("");
  const [collectorInfo, setCollectorInfo] = useState<{ name: string; upi_id: string | null } | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [randomizing, setRandomizing] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  // Ceremony 4: the row just marked paid on this device gets the yellow wash;
  // if that mark settles the whole session, a particle tick fires once.
  const [justPaidId, setJustPaidId] = useState<string | null>(null);
  const justPaidTimer = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    const [sessionRes, votesRes, waitlistRes, turfsRes, dayOptionsRes, attendanceRes] = await Promise.all([
      supabase
        .from("sessions")
        .select(
          "id, group_id, organizer_id, payment_collector_id, turf_id, scheduled_at, ends_at, max_capacity, status, cost_per_head, sport, turfs(name, lat, lng)"
        )
        .eq("id", sessionId)
        .single(),
      supabase
        .from("session_votes")
        .select("user_id, voted_in, guest_count, guest_names, users(name)")
        .eq("session_id", sessionId),
      supabase
        .from("session_waitlist")
        .select("user_id, position, users(name)")
        .eq("session_id", sessionId)
        .order("position", { ascending: true }),
      supabase.from("turfs").select("id, name").order("name"),
      supabase
        .from("session_day_options")
        .select("id, scheduled_at, ends_at")
        .eq("session_id", sessionId)
        .order("scheduled_at", { ascending: true }),
      supabase.from("attendance").select("user_id, attended").eq("session_id", sessionId),
    ]);

    const sessionData = sessionRes.data as unknown as SessionDetail | null;
    setSession(sessionData);
    setVotes((votesRes.data ?? []) as unknown as VoteRow[]);
    setWaitlist((waitlistRes.data ?? []) as unknown as WaitlistRow[]);
    setTurfOptions(turfsRes.data ?? []);
    setAttendance(attendanceRes.data ?? []);
    setCostPerHeadInput(sessionData?.cost_per_head != null ? String(sessionData.cost_per_head) : "");

    const { data: memberOptions } = await supabase
      .from("group_members")
      .select("user_id, users(name)")
      .eq("group_id", groupId);
    setGroupMembersForCollector((memberOptions ?? []) as unknown as GroupMemberOption[]);

    // Group turf tier: recently used ∪ explicitly saved (history first) —
    // primary tier of the set-turf picker.
    const [{ data: usedTurfs }, { data: savedTurfs }] = await Promise.all([
      supabase
        .from("sessions")
        .select("turf_id, created_at")
        .eq("group_id", groupId)
        .not("turf_id", "is", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("group_turfs")
        .select("turf_id")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
    ]);
    const seenTurfs = new Set<string>();
    const orderedTurfs: string[] = [];
    for (const s of usedTurfs ?? []) {
      if (s.turf_id && !seenTurfs.has(s.turf_id)) {
        seenTurfs.add(s.turf_id);
        orderedTurfs.push(s.turf_id);
      }
    }
    for (const g of savedTurfs ?? []) {
      if (!seenTurfs.has(g.turf_id)) {
        seenTurfs.add(g.turf_id);
        orderedTurfs.push(g.turf_id);
      }
    }
    setGroupTurfIds(orderedTurfs);

    if (sessionData) {
      const collectorId = sessionData.payment_collector_id ?? sessionData.organizer_id;
      if (collectorId) {
        const { data: collectorRow } = await supabase
          .from("users")
          .select("name, upi_id")
          .eq("id", collectorId)
          .maybeSingle();
        setCollectorInfo(collectorRow ?? null);
      } else {
        setCollectorInfo(null);
      }

      if (sessionData.status === "completed") {
        const { data: paymentRows } = await supabase
          .from("payments")
          .select("id, payer_id, amount, status, payer:users!payments_payer_id_fkey(name)")
          .eq("session_id", sessionId);
        setPayments((paymentRows ?? []) as unknown as PaymentRow[]);
      } else {
        setPayments([]);
      }

      if (sessionData.status === "locked" || sessionData.status === "completed") {
        const { data: teamRows } = await supabase
          .from("session_captains")
          // `invited_by` is a second FK to users(id), so the embed must name
          // the constraint explicitly — plain `users(name)` is now ambiguous
          // and PostgREST returns 300 Multiple Choices.
          .select("id, user_id, guest_name, team, users!session_captains_user_id_fkey(name)")
          .eq("session_id", sessionId);
        setTeams((teamRows ?? []) as unknown as TeamRow[]);
      } else {
        setTeams([]);
      }
    }

    const options = dayOptionsRes.data ?? [];
    setDayOptions(options);

    if (options.length > 0) {
      const { data: voteRows } = await supabase
        .from("session_day_votes")
        .select("day_option_id, user_id")
        .in(
          "day_option_id",
          options.map((o) => o.id)
        );
      setDayVotes(voteRows ?? []);
    } else {
      setDayVotes([]);
    }

    if (user) {
      const { data: membership } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();
      setIsGroupAdmin(membership?.role === "admin");
    }

    const { data: groupRow } = await supabase
      .from("groups")
      .select("sport")
      .eq("id", groupId)
      .maybeSingle();
    setGroupSport(groupRow?.sport ?? null);

    const { count } = await supabase
      .from("group_members")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", groupId);
    setGroupMemberCount(count ?? 0);

    setLoading(false);
  }, [supabase, sessionId, groupId, user]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, loadData]);

  useEffect(() => {
    if (!user || !session || session.status !== "completed" || !collectorInfo?.upi_id) {
      setQrDataUrl("");
      return;
    }
    const myPayment = payments.find((p) => p.payer_id === user.id);
    const link = buildUpiLink(collectorInfo.upi_id, collectorInfo.name, myPayment?.amount ?? null, "GameDay session");
    generateUpiQr(link)
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [user, session, payments, collectorInfo]);

  // Ceremony 4 finale: when a mark-paid on this device settles the last row,
  // the collection bar hits 100% and gets a particle tick.
  useEffect(() => {
    const paid = payments.filter((p) => p.status === "paid").length;
    const settled = payments.length > 0 && paid === payments.length;
    if (settled && justPaidId) {
      confetti({
        particleCount: 24,
        spread: 70,
        startVelocity: 20,
        origin: { x: 0.5, y: 0.35 },
        colors: ["#E8FF47", "#F2F5EF"],
        disableForReducedMotion: true,
      });
    }
  }, [payments, justPaidId]);

  if (isLoading || !user || loading) return null;
  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-night px-4">
        <p className={eyebrowCls}>Session not found.</p>
      </main>
    );
  }

  const waitlistedIds = new Set(waitlist.map((w) => w.user_id));
  const confirmed = votes.filter((v) => v.voted_in && !waitlistedIds.has(v.user_id));
  const headcount = confirmed.reduce((sum, v) => sum + 1 + v.guest_count, 0);
  const myVote = votes.find((v) => v.user_id === user.id);
  const myStatus = !myVote?.voted_in ? "out" : waitlistedIds.has(user.id) ? "waitlisted" : "confirmed";
  const canManage = session.organizer_id === user.id || isGroupAdmin;
  const isDayPoll = session.status === "proposing";

  const dayTallies = dayOptions
    .map((opt) => ({
      ...opt,
      voterIds: dayVotes.filter((v) => v.day_option_id === opt.id).map((v) => v.user_id),
    }))
    .sort((a, b) => b.voterIds.length - a.voterIds.length);

  const leadingOptionId = dayTallies[0]?.id;
  const finalizeSelection = finalizeChoice || leadingOptionId || "";
  const guestCountNum = Number(guestCountInput) || 0;
  // "Out" = explicitly declined; "yet to vote" = no vote row at all. Showing
  // them separately is what stops the group chasing people who already said no.
  const outVoters = votes.filter((v) => !v.voted_in);
  const votedIds = new Set(votes.map((v) => v.user_id));
  const yetToVote = groupMembersForCollector.filter((m) => !votedIds.has(m.user_id));
  const myPayment = payments.find((p) => p.payer_id === user.id);
  const isCollector = (session.payment_collector_id ?? session.organizer_id) === user.id;

  // Collection progress (Ceremony 4). PostgREST returns numeric as string, so
  // coerce; if any amount is unset, fall back to counting rows.
  const fmtAmt = (a: number | null) => (a != null ? Number(a).toLocaleString("en-IN") : "—");
  const amountsKnown = payments.length > 0 && payments.every((p) => p.amount != null);
  const totalAmount = amountsKnown ? payments.reduce((s, p) => s + Number(p.amount), 0) : 0;
  const collectedAmount = amountsKnown
    ? payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0)
    : 0;
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const collectPct =
    payments.length === 0
      ? 0
      : amountsKnown && totalAmount > 0
      ? Math.round((collectedAmount / totalAmount) * 100)
      : Math.round((paidCount / payments.length) * 100);
  const allSettled = payments.length > 0 && paidCount === payments.length;
  const myGuestCount = myVote?.guest_count ?? 0;

  function updateGuestName(index: number, value: string) {
    setGuestNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function castVote(votedIn: boolean, ev?: React.MouseEvent) {
    setError("");
    // Built by index rather than sliced from guestNames — slicing a shorter
    // array just returns however many entries exist, so an untouched guest
    // field (never typed into, so no entry at all) would silently skip
    // validation instead of showing up as an empty string.
    const trimmedGuestNames = Array.from({ length: guestCountNum }, (_, i) => (guestNames[i] ?? "").trim());
    if (votedIn && guestCountNum > 0 && trimmedGuestNames.some((n) => !n)) {
      setError("Enter a name for each guest");
      return;
    }
    setVoteAction(votedIn ? "in" : "out");
    // Ceremony 1: fire the sweep + burst from the tap point the moment a
    // not-yet-confirmed member votes in (optimistic — failure is rare and
    // still surfaces the error below).
    if (votedIn && myStatus !== "confirmed" && ev) {
      fireCeremony(ev.clientX, ev.clientY);
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          voted_in: votedIn,
          guest_count: votedIn ? guestCountNum : 0,
          guest_names: votedIn ? trimmedGuestNames : [],
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg);
      }
      await loadData();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save your vote. Try again."));
    } finally {
      setVoteAction(null);
    }
  }

  async function toggleDayVote(optionId: string, currentlyVoted: boolean) {
    setDayVoting(true);
    if (currentlyVoted) {
      await supabase
        .from("session_day_votes")
        .delete()
        .eq("day_option_id", optionId)
        .eq("user_id", user!.id);
    } else {
      await supabase.from("session_day_votes").insert({ day_option_id: optionId, user_id: user!.id });
    }
    await loadData();
    setDayVoting(false);
  }

  async function handleFinalizeDay() {
    const winner = dayOptions.find((o) => o.id === finalizeSelection);
    if (!winner) return;
    setFinalizing(true);
    const { error: updateError } = await supabase
      .from("sessions")
      .update({ scheduled_at: winner.scheduled_at, ends_at: winner.ends_at, status: "open" })
      .eq("id", sessionId);
    if (!updateError) await loadData();
    setFinalizing(false);
  }

  // Local (not UTC) date/time components, since sessions are always created
  // at :00/:30 slots via this same picker — no rounding needed on the way back in.
  function toDateInputValue(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function toTimeSlotValue(iso: string) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function openEdit() {
    setEditError("");
    setEditTurfId(session?.turf_id ?? "");
    setEditDate(session?.scheduled_at ? toDateInputValue(session.scheduled_at) : "");
    setEditStart(session?.scheduled_at ? toTimeSlotValue(session.scheduled_at) : "");
    setEditEnd(session?.ends_at ? toTimeSlotValue(session.ends_at) : "");
    setEditMaxCapacity(String(session?.max_capacity ?? ""));
    setEditingSession(true);
  }

  async function handleSaveEdit() {
    setEditError("");
    // A day poll's timing comes from finalizing a day option, not this panel —
    // only turf/capacity apply while a session is still proposing.
    if (!isDayPoll && (!editDate || !editStart || !editEnd)) {
      setEditError("Pick a date and time slot");
      return;
    }
    const capacity = Number(editMaxCapacity) || 1;
    setSavingEdit(true);
    try {
      const updates = {
        turf_id: editTurfId || null,
        max_capacity: capacity,
        ...(!isDayPoll
          ? {
              scheduled_at: new Date(`${editDate}T${editStart}`).toISOString(),
              ends_at: new Date(`${editDate}T${editEnd}`).toISOString(),
            }
          : {}),
      };
      const { error: updateError } = await supabase.from("sessions").update(updates).eq("id", sessionId);
      if (updateError) throw new Error(updateError.message);
      setEditingSession(false);
      await loadData();
    } catch (err) {
      setEditError(friendlyError(err, "Couldn't save changes. Try again."));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleClosePoll() {
    const { error: updateError } = await supabase
      .from("sessions")
      .update({ status: "locked" })
      .eq("id", sessionId);
    if (!updateError) await loadData();
  }

  // Undo for an accidental close — only offered before teams are formed, since
  // re-opening voting after squads are set would leave the roster stale.
  async function handleReopenPoll() {
    setReopening(true);
    const { error: updateError } = await supabase
      .from("sessions")
      .update({ status: "open" })
      .eq("id", sessionId);
    if (!updateError) await loadData();
    setReopening(false);
  }

  async function handleDeleteSession() {
    setDeleteError("");
    setDeleting(true);
    // .select() makes the delete return the removed rows — without it, an
    // RLS-filtered delete "succeeds" with 0 rows and we'd redirect as if it
    // worked while the session quietly survived.
    const { data, error: deleteErr } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .select("id");
    if (deleteErr || !data || data.length === 0) {
      setDeleteError(friendlyError(deleteErr, "Couldn't delete the session. Try again."));
      setDeleting(false);
      return;
    }
    router.replace(`/groups/${groupId}`);
  }

  async function toggleAttendance(userId: string, attended: boolean) {
    setMarkingAttendance(true);
    await supabase
      .from("attendance")
      .upsert(
        { session_id: sessionId, user_id: userId, attended, marked_by: user!.id },
        { onConflict: "session_id,user_id" }
      );
    await loadData();
    setMarkingAttendance(false);
  }

  async function handleMarkComplete() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg);
      }
      await loadData();
    } catch (err) {
      setError(friendlyError(err, "Couldn't complete the session. Try again."));
    } finally {
      setCompleting(false);
    }
  }

  async function handleSetCostPerHead() {
    const value = costPerHeadInput.trim() === "" ? null : Number(costPerHeadInput);
    const { error: updateError } = await supabase
      .from("sessions")
      .update({ cost_per_head: value })
      .eq("id", sessionId);
    if (!updateError) await loadData();
  }

  async function handleSetCollector() {
    if (!selectedCollector) return;
    const { error: updateError } = await supabase
      .from("sessions")
      .update({ payment_collector_id: selectedCollector })
      .eq("id", sessionId);
    if (!updateError) {
      setSettingCollector(false);
      await loadData();
    }
  }

  async function togglePaymentStatus(paymentId: string, newStatus: string) {
    setMarkingPaid(true);
    if (newStatus === "paid") {
      if (justPaidTimer.current) clearTimeout(justPaidTimer.current);
      setJustPaidId(paymentId);
      justPaidTimer.current = window.setTimeout(() => setJustPaidId(null), 1400);
    }
    await supabase
      .from("payments")
      .update({ status: newStatus, marked_at: new Date().toISOString() })
      .eq("id", paymentId);
    await loadData();
    setMarkingPaid(false);
  }

  async function handleRandomizeTeams() {
    setError("");
    setRandomizing(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/teams/randomize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg);
      }
      await loadData();
      setRevealing(true);
    } catch (err) {
      setError(friendlyError(err, "Couldn't form teams. Try again."));
    } finally {
      setRandomizing(false);
    }
  }

  const statusLabel = isDayPoll
    ? "Day poll live"
    : session.status === "open"
    ? "Poll open"
    : session.status === "locked"
    ? "Squads forming"
    : "Completed";
  const sportGlyph = sportEmoji(session.sport ?? groupSport);

  return (
    <main className="min-h-screen bg-night p-6">
      {ceremonyOverlay}
      <AnimatePresence>
        {revealing && teams.length > 0 && (
          <SquadRevealOverlay
            teamA={teams.filter((t) => t.team === "A").map((t) => t.users?.name ?? t.guest_name ?? "?")}
            teamB={teams.filter((t) => t.team === "B").map((t) => t.users?.name ?? t.guest_name ?? "?")}
            emoji={sportGlyph}
            onClose={() => setRevealing(false)}
          />
        )}
      </AnimatePresence>
      <div className="mx-auto max-w-md space-y-6">
        {/* Shares a view-transition-name with the group page's hero card, so
            navigating in reads as the card scaling up into this header. */}
        <div style={{ viewTransitionName: "session-hero" }}>
          <Link
            href={`/groups/${groupId}`}
            className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim hover:text-chalk"
          >
            ← Back
          </Link>

          <div className="mt-3 flex items-center gap-2">
            {(session.status === "open" || isDayPoll) && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-floodlight" />
            )}
            <p className={eyebrowCls}>
              {sportGlyph} {statusLabel}
            </p>
          </div>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-chalk">
            {isDayPoll || !session.scheduled_at
              ? "Which day works?"
              : new Date(session.scheduled_at).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
          </h1>
          {!isDayPoll && session.scheduled_at && (
            <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-chalk-dim">
              {formatTimeRange(session.scheduled_at, session.ends_at)}
            </p>
          )}
          {session.turfs ? (
            <p className="mt-1 text-sm text-chalk-dim">
              {session.turfs.name}
              {session.turfs.lat != null && session.turfs.lng != null && (
                <>
                  {" · "}
                  <a
                    href={`https://www.google.com/maps?q=${session.turfs.lat},${session.turfs.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-floodlight hover:opacity-80"
                  >
                    📍 Map
                  </a>
                </>
              )}
            </p>
          ) : (
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-chalk-dim">
              Turf: not yet decided
            </p>
          )}

          {canManage && session.status !== "completed" && (
            <div className="mt-2">
              {!editingSession ? (
                <button
                  type="button"
                  onClick={openEdit}
                  className="font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk"
                >
                  ✎ Edit session
                </button>
              ) : (
                <div className="mt-2 space-y-3 rounded-xl border border-line bg-turf p-3">
                  {!isDayPoll && (
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={editDate}
                        onClick={(e) => {
                          try {
                            e.currentTarget.showPicker?.();
                          } catch {
                            // Needs user activation; a click always has it, but stay defensive.
                          }
                        }}
                        onChange={(e) => setEditDate(e.target.value)}
                        className={`block w-full cursor-pointer ${inputCls}`}
                      />
                      <TimeRangeSelect
                        start={editStart}
                        end={editEnd}
                        onStartChange={setEditStart}
                        onEndChange={setEditEnd}
                      />
                    </div>
                  )}
                  <TurfSelect
                    turfs={turfOptions}
                    groupTurfIds={groupTurfIds}
                    value={editTurfId}
                    onChange={setEditTurfId}
                    className="block w-full"
                  />
                  <div className="flex items-center gap-3">
                    <p className={eyebrowCls}>Max capacity</p>
                    <NumberStepper value={editMaxCapacity} onChange={setEditMaxCapacity} min={1} />
                  </div>
                  {editError && <p className="text-sm text-card-red">{editError}</p>}
                  <div className="flex items-center gap-3">
                    <NeoPopButton
                      variant="secondary"
                      size="sm"
                      onClick={handleSaveEdit}
                      loading={savingEdit}
                    >
                      {savingEdit ? "SAVING…" : "Save"}
                    </NeoPopButton>
                    <button
                      type="button"
                      onClick={() => setEditingSession(false)}
                      className="px-2 py-2.5 font-mono text-xs uppercase text-chalk-dim hover:text-chalk"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isDayPoll && (
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-chalk-dim">
              {dayOptions[0]
                ? `Vote for every day that works · ${formatTimeRange(dayOptions[0].scheduled_at, dayOptions[0].ends_at)}`
                : "Vote for every day that works"}
            </p>
          )}
        </div>

        {isDayPoll && (
          <div className="space-y-3">
            {dayTallies.map((opt) => {
              const iVoted = opt.voterIds.includes(user.id);
              const pct = groupMemberCount > 0 ? (opt.voterIds.length / groupMemberCount) * 100 : 0;
              const isLeading = opt.id === leadingOptionId && opt.voterIds.length > 0;
              return (
                <div
                  key={opt.id}
                  className={`rounded-xl border bg-turf p-4 space-y-3 ${
                    isLeading ? "border-floodlight/60" : "border-line"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-chalk">
                      {new Date(opt.scheduled_at).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <button
                      onClick={() => toggleDayVote(opt.id, iVoted)}
                      disabled={dayVoting}
                      className={`rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50 ${
                        iVoted
                          ? "bg-floodlight font-semibold text-night"
                          : "border border-line text-chalk-dim hover:border-chalk-dim hover:text-chalk"
                      }`}
                    >
                      {iVoted ? "I can make it ✓" : "I can make it"}
                    </button>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-night">
                    <div
                      className="h-full w-full origin-left rounded-full bg-floodlight transition-transform duration-500 motion-reduce:transition-none"
                      style={{ transform: `scaleX(${Math.min(1, pct / 100)})` }}
                    />
                  </div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                    {opt.voterIds.length} of {groupMemberCount} can make it
                  </p>
                </div>
              );
            })}

            {canManage && (
              <div className="rounded-xl border border-line bg-turf p-4 space-y-3">
                <p className={eyebrowCls}>Finalize the day</p>
                <select
                  value={finalizeSelection}
                  onChange={(e) => setFinalizeChoice(e.target.value)}
                  className={`block w-full ${inputCls}`}
                >
                  {dayTallies.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {new Date(opt.scheduled_at).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      — {opt.voterIds.length} votes
                      {opt.id === leadingOptionId ? " (leading)" : ""}
                    </option>
                  ))}
                </select>
                <NeoPopButton
                  className="w-full"
                  onClick={handleFinalizeDay}
                  loading={finalizing}
                  spinner={sportGlyph}
                >
                  {finalizing ? "LOCKING IN…" : "LOCK IN THIS DAY"}
                </NeoPopButton>
              </div>
            )}
          </div>
        )}

        {!isDayPoll && (
          <div className="rounded-2xl border border-line bg-turf p-5">
            <p className={eyebrowCls}>Confirmed</p>
            <div className="relative mt-1 inline-block">
              <motion.span
                key={headcount}
                initial={{ opacity: 0.9 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className="pointer-events-none absolute -inset-3 rounded-full bg-floodlight/15 blur-xl"
              />
              <p className="relative text-6xl font-bold tracking-tighter text-chalk">
                <CountUp value={headcount} />
                <span className="ml-1.5 text-2xl font-semibold tracking-normal text-chalk-dim">
                  /{session.max_capacity}
                </span>
              </p>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-night">
              <div
                className="h-full w-full origin-left rounded-full bg-floodlight transition-transform duration-500 motion-reduce:transition-none"
                style={{ transform: `scaleX(${Math.min(1, headcount / session.max_capacity)})` }}
              />
            </div>
          </div>
        )}

        {!isDayPoll && session.status === "open" && (
          <div className="rounded-2xl border border-line bg-turf p-5 space-y-4">
            <p className="text-sm text-chalk-dim">
              Your status:{" "}
              <span
                className={`font-semibold ${
                  myStatus === "confirmed"
                    ? "text-floodlight"
                    : myStatus === "waitlisted"
                    ? "text-chalk"
                    : "text-chalk-dim"
                }`}
              >
                {myStatus === "confirmed" ? "In ✓" : myStatus === "waitlisted" ? "Waitlisted" : "Not in"}
              </span>
            </p>

            <div className="flex items-center gap-3">
              <p className={eyebrowCls}>Guests</p>
              <NumberStepper value={guestCountInput} onChange={setGuestCountInput} min={0} />
            </div>

            {guestCountNum > 0 && (
              <div className="space-y-2">
                {Array.from({ length: guestCountNum }).map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    required
                    placeholder={`Guest ${i + 1} name (required)`}
                    value={guestNames[i] ?? ""}
                    onChange={(e) => updateGuestName(i, e.target.value)}
                    className={`block w-full ${inputCls}`}
                  />
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <NeoPopButton
                className="flex-1"
                onClick={(e) => castVote(true, e)}
                loading={voteAction === "in"}
                spinner={sportGlyph}
                disabled={voteAction !== null}
              >
                {voteAction === "in"
                  ? myStatus === "confirmed"
                    ? "UPDATING…"
                    : "LOCKING YOU IN…"
                  : myStatus === "confirmed"
                  ? "YOU'RE IN ✓"
                  : "I'M IN"}
              </NeoPopButton>
              <NeoPopButton
                variant="secondary"
                className="flex-1"
                onClick={() => castVote(false)}
                loading={voteAction === "out"}
                spinner={sportGlyph}
                disabled={voteAction !== null}
              >
                {voteAction === "out" ? "DROPPING…" : "I'M OUT"}
              </NeoPopButton>
            </div>

            {error && <p className="text-sm text-card-red">{error}</p>}
          </div>
        )}

        {!isDayPoll && (
          <div className="space-y-2">
            <p className={eyebrowCls}>Confirmed · {confirmed.length}</p>
            {confirmed.length === 0 ? (
              <p className="font-mono text-xs uppercase tracking-wider text-chalk-dim/70">
                No one yet.
              </p>
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {confirmed.map((v) => (
                    <motion.li
                      key={v.user_id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="flex items-center gap-3 rounded-lg border border-line bg-turf px-3 py-2.5"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-turf-raised text-[11px] font-semibold text-chalk">
                        {initials(v.users?.name ?? "?")}
                      </span>
                      <span className="text-sm text-chalk">{v.users?.name}</span>
                      {v.guest_count > 0 && (
                        <span
                          className="ml-auto font-mono text-[11px] text-chalk-dim"
                          title={v.guest_names.join(", ")}
                        >
                          +{v.guest_count}
                          {v.guest_names.length > 0 ? ` · ${v.guest_names.join(", ")}` : ""}
                        </span>
                      )}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        )}

        {!isDayPoll && waitlist.length > 0 && (
          <div className="space-y-2">
            <p className={eyebrowCls}>Waitlist · {waitlist.length}</p>
            <ul className="space-y-1.5">
              {waitlist.map((w, i) => (
                <li
                  key={w.user_id}
                  className="flex items-center gap-3 rounded-lg border border-line/50 px-3 py-2 opacity-60"
                >
                  <span className="font-mono text-[11px] text-chalk-dim">{i + 1}</span>
                  <span className="text-sm text-chalk-dim">{w.users?.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isDayPoll && session.status === "open" && outVoters.length > 0 && (
          <div className="space-y-2">
            <p className={eyebrowCls}>
              Out · {outVoters.length}
              <span className="ml-2 normal-case tracking-normal text-chalk-dim/60">
                already answered — no need to ask
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {outVoters.map((v) => (
                <span
                  key={v.user_id}
                  className="rounded-full border border-card-red/25 bg-card-red/5 px-2.5 py-1 text-xs text-chalk-dim"
                >
                  {v.users?.name} <span className="text-card-red/70">✕</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {!isDayPoll && session.status === "open" && yetToVote.length > 0 && (
          <div className="space-y-2">
            <p className={eyebrowCls}>
              Yet to vote · {yetToVote.length}
              <span className="ml-2 normal-case tracking-normal text-chalk-dim/60">
                these are the ones to nudge
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {yetToVote.map((m) => (
                <span
                  key={m.user_id}
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-chalk-dim"
                >
                  {m.users?.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {!isDayPoll && session.status !== "open" && (
          <div className="space-y-2">
            <p className={eyebrowCls}>Attendance</p>
            {confirmed.length === 0 ? (
              <p className="font-mono text-xs uppercase tracking-wider text-chalk-dim/70">
                No one was confirmed for this session.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {confirmed.map((v) => {
                  const record = attendance.find((a) => a.user_id === v.user_id);
                  const attended = record?.attended ?? false;
                  return (
                    <li
                      key={v.user_id}
                      className="flex items-center justify-between rounded-lg border border-line bg-turf px-3 py-2"
                    >
                      <span className="text-sm text-chalk">{v.users?.name}</span>
                      {canManage ? (
                        <button
                          onClick={() => toggleAttendance(v.user_id, !attended)}
                          disabled={markingAttendance}
                          className={`rounded-full px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50 ${
                            attended
                              ? "bg-floodlight font-semibold text-night"
                              : "border border-line text-chalk-dim hover:border-chalk-dim hover:text-chalk"
                          }`}
                        >
                          {attended ? "Attended ✓" : "No show"}
                        </button>
                      ) : (
                        <span
                          className={`font-mono text-[11px] uppercase tracking-wider ${
                            attended ? "text-floodlight" : "text-chalk-dim"
                          }`}
                        >
                          {record ? (attended ? "Attended ✓" : "No show") : "Not marked"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {!isDayPoll && (session.status === "locked" || session.status === "completed") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className={eyebrowCls}>Squad</p>
              {canManage && teams.length > 0 && (
                <button
                  onClick={handleRandomizeTeams}
                  disabled={randomizing}
                  className="font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk disabled:opacity-50"
                >
                  {randomizing ? "Randomizing…" : "Re-randomize"}
                </button>
              )}
            </div>

            {error && <p className="text-sm text-card-red">{error}</p>}

            {teams.length === 0 ? (
              canManage ? (
                <NeoPopButton
                  className="w-full"
                  onClick={handleRandomizeTeams}
                  loading={randomizing}
                  spinner={sportGlyph}
                >
                  {randomizing ? "FORMING…" : "FORM TEAMS"}
                </NeoPopButton>
              ) : (
                <p className="font-mono text-xs uppercase tracking-wider text-chalk-dim/70">
                  Teams haven&apos;t been formed yet.
                </p>
              )
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(["A", "B"] as const).map((teamKey) => (
                  <div key={teamKey} className="rounded-xl border border-line bg-turf p-3">
                    <p className={eyebrowCls}>Team {teamKey}</p>
                    <ul className="mt-2 space-y-1.5">
                      {teams
                        .filter((t) => t.team === teamKey)
                        .map((t) => (
                          <li key={t.id} className="text-sm text-chalk">
                            {t.users?.name ?? t.guest_name}
                            {t.guest_name && (
                              <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                                guest
                              </span>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isDayPoll && canManage && session.status === "locked" && (
          <div className="rounded-xl border border-line bg-turf p-4 space-y-4">
            <p className={eyebrowCls}>Payment setup</p>

            <div>
              <label htmlFor="costPerHead" className="block font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                Cost per head (₹)
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="costPerHead"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 150"
                  value={costPerHeadInput}
                  onChange={(e) => setCostPerHeadInput(e.target.value)}
                  className={`no-spinner flex-1 ${inputCls}`}
                />
                <NeoPopButton variant="secondary" size="sm" onClick={handleSetCostPerHead}>
                  Save
                </NeoPopButton>
              </div>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                Collector: <span className="text-chalk">{collectorInfo?.name ?? "Not set"}</span>
                {session.payment_collector_id ? "" : " (organizer, default)"}
              </p>
              {!settingCollector ? (
                <button
                  type="button"
                  onClick={() => setSettingCollector(true)}
                  className="mt-1.5 font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk"
                >
                  Reassign collector
                </button>
              ) : (
                <div className="mt-1.5 flex items-center gap-2">
                  <select
                    value={selectedCollector}
                    onChange={(e) => setSelectedCollector(e.target.value)}
                    className={`flex-1 ${inputCls}`}
                  >
                    <option value="">Pick a member</option>
                    {groupMembersForCollector.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.users?.name}
                      </option>
                    ))}
                  </select>
                  <NeoPopButton
                    variant="secondary"
                    size="sm"
                    onClick={handleSetCollector}
                    disabled={!selectedCollector}
                  >
                    Save
                  </NeoPopButton>
                  <button
                    onClick={() => setSettingCollector(false)}
                    className="px-2 py-2.5 font-mono text-xs uppercase text-chalk-dim hover:text-chalk"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!isDayPoll && session.status === "completed" && (
          <div className="space-y-3">
            <p className={eyebrowCls}>Payments</p>

            {payments.length > 0 && (
              <div className="rounded-xl border border-line bg-turf p-4 space-y-2">
                {allSettled ? (
                  <p className="font-mono text-xs uppercase tracking-wider text-floodlight">
                    All settled{amountsKnown ? ` — ₹${fmtAmt(totalAmount)} / ₹${fmtAmt(totalAmount)}` : ""} ✓
                  </p>
                ) : (
                  <p className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
                    Collected{" "}
                    <span className="text-chalk">
                      {amountsKnown
                        ? `₹${fmtAmt(collectedAmount)} / ₹${fmtAmt(totalAmount)}`
                        : `${paidCount} / ${payments.length}`}
                    </span>
                  </p>
                )}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-night">
                  <div
                    className="h-full w-full origin-left rounded-full bg-floodlight transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                    style={{ transform: `scaleX(${Math.min(1, collectPct / 100)})` }}
                  />
                </div>
              </div>
            )}

            <div className="rounded-xl border border-line bg-turf p-4 space-y-3">
              <p className="text-sm text-chalk-dim">
                Collector: <span className="font-semibold text-chalk">{collectorInfo?.name ?? "Not set"}</span>
              </p>
              {myPayment && (
                <div>
                  <p className={eyebrowCls}>{myPayment.status === "paid" ? "You paid" : "You owe"}</p>
                  <p
                    className={`text-5xl font-bold tracking-tighter ${
                      myPayment.status === "paid" ? "text-chalk-dim" : "text-chalk"
                    }`}
                  >
                    {myPayment.amount != null ? `₹${fmtAmt(myPayment.amount)}` : "—"}
                  </p>
                  {session.cost_per_head != null && myGuestCount > 0 && (
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                      ₹{fmtAmt(session.cost_per_head)} + {myGuestCount} guest{myGuestCount > 1 ? "s" : ""}
                    </p>
                  )}
                  {myPayment.status === "paid" && (
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-floodlight">
                      Settled ✓
                    </p>
                  )}
                </div>
              )}
              {!isCollector && collectorInfo?.upi_id && myPayment && myPayment.status !== "paid" && (
                <div className="space-y-3">
                  {qrDataUrl && (
                    <div className="mx-auto w-fit rounded-xl bg-chalk p-3 shadow-[0_0_24px_rgba(232,255,71,0.15)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrDataUrl} alt="UPI payment QR code" className="h-40 w-40" />
                    </div>
                  )}
                  <a
                    href={buildUpiLink(collectorInfo.upi_id, collectorInfo.name, myPayment.amount, "GameDay session")}
                    className="block"
                  >
                    <NeoPopButton className="w-full">PAY WITH UPI APP</NeoPopButton>
                  </a>
                </div>
              )}
              {collectorInfo && !collectorInfo.upi_id && isCollector && (
                <p className="font-mono text-[11px] uppercase tracking-wider text-floodlight/80">
                  Add your UPI ID on your profile so members can pay you directly.
                </p>
              )}
            </div>

            <ul className="space-y-1.5">
              {payments.map((p) => {
                const paid = p.status === "paid";
                return (
                  <li
                    key={p.id}
                    className={`relative flex items-center justify-between overflow-hidden rounded-lg border px-3 py-2 ${
                      paid
                        ? "border-floodlight/10 bg-[rgba(232,255,71,0.05)]"
                        : "border-line bg-turf"
                    }`}
                  >
                    {justPaidId === p.id && (
                      <motion.span
                        initial={{ opacity: 0.45 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.9 }}
                        className="pointer-events-none absolute inset-0 bg-floodlight"
                      />
                    )}
                    <span className={`relative text-sm ${paid ? "text-chalk-dim" : "text-chalk"}`}>
                      <span className="relative inline-block">
                        {p.payer?.name} {p.amount != null ? `· ₹${fmtAmt(p.amount)}` : ""}
                        {paid && (
                          <motion.span
                            key={`${p.id}-strike`}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="absolute left-0 top-1/2 h-px w-full origin-left bg-chalk-dim"
                          />
                        )}
                      </span>
                    </span>
                    {paid ? (
                      p.payer_id === user.id || isCollector ? (
                        <button
                          onClick={() => togglePaymentStatus(p.id, "pending")}
                          disabled={markingPaid}
                          className="relative rounded-full bg-floodlight px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-night disabled:opacity-50"
                        >
                          Paid ✓
                        </button>
                      ) : (
                        <span className="relative font-mono text-[11px] uppercase tracking-wider text-floodlight">
                          Paid ✓
                        </span>
                      )
                    ) : p.payer_id === user.id ? (
                      <HoldToConfirm
                        onConfirm={() => togglePaymentStatus(p.id, "paid")}
                        disabled={markingPaid}
                      >
                        Hold to mark paid
                      </HoldToConfirm>
                    ) : isCollector ? (
                      <button
                        onClick={() => togglePaymentStatus(p.id, "paid")}
                        disabled={markingPaid}
                        className="relative rounded-full border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-chalk-dim transition-colors hover:border-chalk-dim hover:text-chalk disabled:opacity-50"
                      >
                        Mark as Paid
                      </button>
                    ) : (
                      <span className="relative font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                        Pending
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!isDayPoll && canManage && session.status === "open" && (
          <NeoPopButton variant="danger" className="w-full" onClick={handleClosePoll}>
            CLOSE POLL
          </NeoPopButton>
        )}

        {!isDayPoll && canManage && session.status === "locked" && (
          // One floodlight action per screen: while FORM TEAMS is the yellow
          // CTA (teams not yet formed), completing demotes to secondary.
          <NeoPopButton
            variant={teams.length === 0 ? "secondary" : "primary"}
            className="w-full"
            onClick={handleMarkComplete}
            loading={completing}
            spinner={sportGlyph}
          >
            {completing ? "COMPLETING…" : "MARK SESSION COMPLETE"}
          </NeoPopButton>
        )}

        {!isDayPoll && canManage && session.status === "locked" && teams.length === 0 && (
          // Undo for an accidental close — hidden once teams are formed, since
          // re-opening voting after squads are set would leave the roster stale.
          <button
            type="button"
            onClick={handleReopenPoll}
            disabled={reopening}
            className="w-full py-2 text-center font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk disabled:opacity-50"
          >
            {reopening ? "Reopening…" : "↺ Reopen poll"}
          </button>
        )}

        {canManage && (
          // Irreversible — takes votes, attendance, teams, and payment records
          // with it (cascade). Hold-to-confirm with a longer press than
          // mark-paid so it can't happen by accident.
          <div className="flex flex-col items-center gap-2 pt-4">
            <HoldToConfirm onConfirm={handleDeleteSession} disabled={deleting} danger duration={1200}>
              {deleting ? "Deleting…" : "Hold to delete session"}
            </HoldToConfirm>
            {deleteError && <p className="text-sm text-card-red">{deleteError}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
