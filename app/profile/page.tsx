"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useSupabase } from "@/lib/auth-context";
import { CountUp } from "@/components/CountUp";
import { StreakMilestoneOverlay, useStreakMilestone } from "@/components/StreakMilestone";

interface GroupMembership {
  group_id: string;
  groups: { name: string } | null;
}

interface AttendanceWithSession {
  attended: boolean;
  sessions: { scheduled_at: string | null; group_id: string } | null;
}

interface GroupStats {
  groupId: string;
  name: string;
  total: number;
  attended: number;
  pct: number;
  streak: number;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const supabase = useSupabase();
  const [groupStats, setGroupStats] = useState<GroupStats[]>([]);
  const [reliabilityPct, setReliabilityPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [upiIdInput, setUpiIdInput] = useState("");
  const [savingUpi, setSavingUpi] = useState(false);
  const [upiSaved, setUpiSaved] = useState(false);

  const { celebrating, dismiss } = useStreakMilestone(
    groupStats.map((g) => ({ key: g.groupId, streak: g.streak }))
  );

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      supabase.from("group_members").select("group_id, groups(name)").eq("user_id", user.id),
      supabase
        .from("attendance")
        .select("attended, sessions!inner(scheduled_at, group_id)")
        .eq("user_id", user.id),
      supabase.from("users").select("upi_id").eq("id", user.id).single(),
      supabase.from("payments").select("status").eq("payer_id", user.id),
    ]).then(([membershipsRes, attendanceRes, userRes, paymentsRes]) => {
      setUpiIdInput(userRes.data?.upi_id ?? "");

      const paymentRows = paymentsRes.data ?? [];
      setReliabilityPct(
        paymentRows.length > 0
          ? Math.round(
              (paymentRows.filter((p) => p.status === "paid").length / paymentRows.length) * 100
            )
          : null
      );

      const memberships = (membershipsRes.data ?? []) as unknown as GroupMembership[];
      const records = (attendanceRes.data ?? []) as unknown as AttendanceWithSession[];

      const byGroup = new Map<string, AttendanceWithSession[]>();
      for (const r of records) {
        if (!r.sessions?.scheduled_at) continue;
        const list = byGroup.get(r.sessions.group_id) ?? [];
        list.push(r);
        byGroup.set(r.sessions.group_id, list);
      }

      const stats = memberships.map((m): GroupStats => {
        const rows = (byGroup.get(m.group_id) ?? []).sort(
          (a, b) =>
            new Date(a.sessions!.scheduled_at!).getTime() -
            new Date(b.sessions!.scheduled_at!).getTime()
        );
        const total = rows.length;
        const attended = rows.filter((r) => r.attended).length;

        let streak = 0;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].attended) streak++;
          else break;
        }

        return {
          groupId: m.group_id,
          name: m.groups?.name ?? "Unknown group",
          total,
          attended,
          pct: total > 0 ? Math.round((attended / total) * 100) : 0,
          streak,
        };
      });

      setGroupStats(stats);
      setLoading(false);
    });
  }, [user, supabase]);

  async function handleSaveUpi() {
    setSavingUpi(true);
    setUpiSaved(false);
    const { error } = await supabase
      .from("users")
      .update({ upi_id: upiIdInput.trim() || null })
      .eq("id", user!.id);
    setSavingUpi(false);
    if (!error) setUpiSaved(true);
  }

  if (isLoading || !user || loading) return null;

  const overallTotal = groupStats.reduce((sum, g) => sum + g.total, 0);
  const overallAttended = groupStats.reduce((sum, g) => sum + g.attended, 0);
  const overallPct = overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 100) : 0;
  const bestStreak = groupStats.reduce((max, g) => Math.max(max, g.streak), 0);

  return (
    <main className="min-h-screen bg-night p-6">
      <StreakMilestoneOverlay celebrating={celebrating} dismiss={dismiss} />
      <div className="mx-auto max-w-md space-y-8">
        <Link
          href="/"
          className="inline-block font-mono text-[11px] uppercase tracking-widest text-chalk-dim hover:text-chalk"
        >
          ← Home
        </Link>

        {/* The jersey: avatar top-center, streak as the biggest numeral on screen */}
        <div className="flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-turf-raised text-2xl font-bold text-chalk ring-2 ring-line">
            {initials(user.name)}
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-chalk">{user.name}</h1>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.25em] text-chalk-dim">
            Week streak
          </p>
          <p className="text-8xl font-bold tracking-tighter text-chalk">
            <CountUp value={bestStreak} />
          </p>
          {bestStreak > 0 && <span className="text-2xl">🔥</span>}

          <div className="mt-6 grid w-full grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-turf py-3">
              <p className="text-2xl font-bold tracking-tight text-chalk">{overallAttended}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-chalk-dim">
                Games
              </p>
            </div>
            <div className="rounded-xl border border-line bg-turf py-3">
              <p className="text-2xl font-bold tracking-tight text-chalk">
                {overallTotal > 0 ? `${overallPct}%` : "—"}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-chalk-dim">
                Attendance
              </p>
            </div>
            <div className="rounded-xl border border-line bg-turf py-3">
              <p className="text-2xl font-bold tracking-tight text-chalk">
                {reliabilityPct != null ? `${reliabilityPct}%` : "—"}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-chalk-dim">
                Reliability
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-turf p-4 space-y-2">
          <label
            htmlFor="upiId"
            className="block font-mono text-[11px] uppercase tracking-widest text-chalk-dim"
          >
            Your UPI ID
          </label>
          <p className="text-xs text-chalk-dim">
            Set this so others can pay you directly when you&apos;re the collector for a session.
          </p>
          <div className="flex gap-2">
            <input
              id="upiId"
              type="text"
              placeholder="you@upi"
              value={upiIdInput}
              onChange={(e) => {
                setUpiIdInput(e.target.value);
                setUpiSaved(false);
              }}
              className="flex-1 rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
            />
            <button
              onClick={handleSaveUpi}
              disabled={savingUpi}
              className="rounded-lg border border-line bg-turf-raised px-4 py-2 text-sm font-semibold text-chalk transition-colors hover:border-chalk-dim disabled:opacity-50"
            >
              {savingUpi ? "Saving…" : "Save"}
            </button>
          </div>
          {upiSaved && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-floodlight">Saved ✓</p>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
            By group
          </h2>
          {groupStats.length === 0 ? (
            <p className="font-mono text-xs uppercase tracking-wider text-chalk-dim/70">
              You&apos;re not in any groups yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {groupStats.map((g) => (
                <li key={g.groupId}>
                  <Link
                    href={`/groups/${g.groupId}/leaderboard`}
                    className="flex items-center justify-between rounded-xl border border-line bg-turf p-4 transition-colors hover:border-chalk-dim"
                  >
                    <div>
                      <p className="font-semibold text-chalk">{g.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                        {g.attended}/{g.total} games · {g.pct}% attendance
                      </p>
                    </div>
                    {g.streak > 0 && (
                      <span className="rounded-full border border-line bg-turf-raised px-2.5 py-1 font-mono text-xs text-chalk">
                        🔥 {g.streak}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
