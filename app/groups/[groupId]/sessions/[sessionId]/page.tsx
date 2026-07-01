"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, useSupabase } from "@/lib/auth-context";

interface SessionDetail {
  id: string;
  group_id: string;
  organizer_id: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  max_capacity: number;
  status: string;
  turfs: { name: string; address: string | null } | null;
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
  users: { name: string } | null;
}

interface WaitlistRow {
  user_id: string;
  position: number;
  users: { name: string } | null;
}

export default function SessionPage() {
  const { groupId, sessionId } = useParams<{ groupId: string; sessionId: string }>();
  const router = useRouter();
  const { user, accessToken, isLoading } = useAuth();
  const supabase = useSupabase();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guestCount, setGuestCount] = useState(0);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const [turfOptions, setTurfOptions] = useState<TurfOption[]>([]);
  const [settingTurf, setSettingTurf] = useState(false);
  const [selectedTurf, setSelectedTurf] = useState("");
  const [dayOptions, setDayOptions] = useState<DayOptionRow[]>([]);
  const [dayVotes, setDayVotes] = useState<DayVoteRow[]>([]);
  const [dayVoting, setDayVoting] = useState(false);
  const [finalizeChoice, setFinalizeChoice] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [groupMemberCount, setGroupMemberCount] = useState(0);

  const loadData = useCallback(async () => {
    const [sessionRes, votesRes, waitlistRes, turfsRes, dayOptionsRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, group_id, organizer_id, scheduled_at, ends_at, max_capacity, status, turfs(name, address)")
        .eq("id", sessionId)
        .single(),
      supabase
        .from("session_votes")
        .select("user_id, voted_in, guest_count, users(name)")
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
    ]);

    setSession(sessionRes.data as unknown as SessionDetail);
    setVotes((votesRes.data ?? []) as unknown as VoteRow[]);
    setWaitlist((waitlistRes.data ?? []) as unknown as WaitlistRow[]);
    setTurfOptions(turfsRes.data ?? []);

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

  if (isLoading || !user || loading) return null;
  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <p className="text-sm text-gray-500">Session not found.</p>
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

  async function castVote(votedIn: boolean) {
    setError("");
    setVoting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ voted_in: votedIn, guest_count: votedIn ? guestCount : 0 }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg);
      }
      await loadData();
    } catch (err: any) {
      setError(err.message ?? "Failed to vote");
    } finally {
      setVoting(false);
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

  async function handleSetTurf() {
    if (!selectedTurf) return;
    const { error: updateError } = await supabase
      .from("sessions")
      .update({ turf_id: selectedTurf })
      .eq("id", sessionId);
    if (!updateError) {
      setSettingTurf(false);
      await loadData();
    }
  }

  async function handleClosePoll() {
    const { error: updateError } = await supabase
      .from("sessions")
      .update({ status: "locked" })
      .eq("id", sessionId);
    if (!updateError) await loadData();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <Link href={`/groups/${groupId}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {isDayPoll || !session.scheduled_at
              ? "🗳️ Which day works?"
              : new Date(session.scheduled_at).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
          </h1>
          {!isDayPoll && session.scheduled_at && (
            <p className="text-sm font-medium text-gray-600">
              {formatTimeRange(session.scheduled_at, session.ends_at)}
            </p>
          )}
          {session.turfs ? (
            <p className="text-sm text-gray-500">
              {session.turfs.name}
              {session.turfs.address ? ` · ${session.turfs.address}` : ""}
            </p>
          ) : (
            <p className="text-sm text-gray-400">Turf: not yet decided</p>
          )}

          {!session.turfs && canManage && (
            <div className="mt-2">
              {!settingTurf ? (
                <button
                  type="button"
                  onClick={() => setSettingTurf(true)}
                  className="text-xs font-medium text-green-600 hover:text-green-700"
                >
                  + Set turf
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTurf}
                    onChange={(e) => setSelectedTurf(e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    <option value="">Pick a turf</option>
                    {turfOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSetTurf}
                    disabled={!selectedTurf}
                    className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingTurf(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="mt-1 text-xs text-gray-400">
            {isDayPoll
              ? dayOptions[0]
                ? `Vote for every day that works · ${formatTimeRange(dayOptions[0].scheduled_at, dayOptions[0].ends_at)}`
                : "Vote for every day that works"
              : session.status === "open"
              ? "Voting open"
              : `Voting ${session.status}`}
          </p>
        </div>

        {isDayPoll && (
          <div className="space-y-2">
            {dayTallies.map((opt) => {
              const iVoted = opt.voterIds.includes(user.id);
              const pct = groupMemberCount > 0 ? (opt.voterIds.length / groupMemberCount) * 100 : 0;
              return (
                <div
                  key={opt.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(opt.scheduled_at).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <button
                      onClick={() => toggleDayVote(opt.id, iVoted)}
                      disabled={dayVoting}
                      className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                        iVoted
                          ? "bg-green-600 text-white"
                          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {iVoted ? "I can make it ✓" : "I can make it"}
                    </button>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {opt.voterIds.length} of {groupMemberCount} can make it
                  </p>
                </div>
              );
            })}

            {canManage && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Finalize the day</p>
                <select
                  value={finalizeSelection}
                  onChange={(e) => setFinalizeChoice(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
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
                <button
                  onClick={handleFinalizeDay}
                  disabled={finalizing}
                  className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {finalizing ? "Locking in…" : "Lock in this day"}
                </button>
              </div>
            )}
          </div>
        )}

        {!isDayPoll && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-700">
              {headcount} / {session.max_capacity} confirmed
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-green-500"
                style={{ width: `${Math.min(100, (headcount / session.max_capacity) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {!isDayPoll && session.status === "open" && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">
              Your status:{" "}
              <span
                className={
                  myStatus === "confirmed"
                    ? "text-green-600"
                    : myStatus === "waitlisted"
                    ? "text-amber-600"
                    : "text-gray-400"
                }
              >
                {myStatus === "confirmed" ? "In ✓" : myStatus === "waitlisted" ? "Waitlisted" : "Not in"}
              </span>
            </p>

            <div className="flex items-center gap-2">
              <label htmlFor="guests" className="text-sm text-gray-600">
                Guests
              </label>
              <input
                id="guests"
                type="number"
                min={0}
                value={guestCount}
                onChange={(e) => setGuestCount(Math.max(0, Number(e.target.value)))}
                className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => castVote(true)}
                disabled={voting}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                I&apos;m in
              </button>
              <button
                onClick={() => castVote(false)}
                disabled={voting}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                I&apos;m out
              </button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {!isDayPoll && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">Confirmed ({confirmed.length})</h2>
            {confirmed.length === 0 ? (
              <p className="text-sm text-gray-400">No one yet.</p>
            ) : (
              <ul className="space-y-1">
                {confirmed.map((v) => (
                  <li key={v.user_id} className="text-sm text-gray-700">
                    {v.users?.name} {v.guest_count > 0 ? `+${v.guest_count}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!isDayPoll && waitlist.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">Waitlist</h2>
            <ul className="space-y-1">
              {waitlist.map((w, i) => (
                <li key={w.user_id} className="text-sm text-gray-500">
                  {i + 1}. {w.users?.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isDayPoll && canManage && session.status === "open" && (
          <button
            onClick={handleClosePoll}
            className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Close poll
          </button>
        )}
      </div>
    </main>
  );
}
