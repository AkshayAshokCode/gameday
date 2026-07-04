"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useAuth, useSupabase } from "@/lib/auth-context";

interface MemberRow {
  user_id: string;
  users: { name: string } | null;
}

interface AttendanceWithSession {
  user_id: string;
  attended: boolean;
  sessions: { scheduled_at: string | null } | null;
}

interface PaymentWithSession {
  payer_id: string;
  status: string;
  sessions: { group_id: string } | null;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  total: number;
  attended: number;
  pct: number;
  streak: number;
  paymentTotal: number;
  paymentPaid: number;
  paymentPct: number | null;
}

type Tab = "streak" | "attendance" | "paid";

const TABS: { id: Tab; label: string }[] = [
  { id: "streak", label: "Streak" },
  { id: "attendance", label: "Attendance" },
  { id: "paid", label: "Paid" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function statFor(e: LeaderboardEntry, tab: Tab) {
  if (tab === "streak") return e.streak > 0 ? `🔥 ${e.streak}` : "—";
  if (tab === "attendance") return e.total > 0 ? `${e.pct}%` : "—";
  return e.paymentPct != null ? `${e.paymentPct}%` : "—";
}

export default function LeaderboardPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const supabase = useSupabase();
  const [groupName, setGroupName] = useState("");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("streak");
  // Staggered fade-up on first view only — tab switches must not re-run it.
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  // Leaderboard is temporarily disabled — kick anyone who lands here (bookmark,
  // back button, etc.) back to the group page. Remove this effect to re-enable.
  useEffect(() => {
    router.replace(`/groups/${groupId}`);
  }, [router, groupId]);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setHasAnimated(true), 800);
      return () => clearTimeout(t);
    }
  }, [loading]);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      supabase.from("groups").select("name").eq("id", groupId).single(),
      supabase.from("group_members").select("user_id, users(name)").eq("group_id", groupId),
      supabase
        .from("attendance")
        .select("user_id, attended, sessions!inner(scheduled_at, group_id)")
        .eq("sessions.group_id", groupId),
      supabase
        .from("payments")
        .select("payer_id, status, sessions!inner(group_id)")
        .eq("sessions.group_id", groupId),
    ]).then(([groupRes, membersRes, attendanceRes, paymentsRes]) => {
      setGroupName(groupRes.data?.name ?? "");

      const members = (membersRes.data ?? []) as unknown as MemberRow[];
      const records = (attendanceRes.data ?? []) as unknown as AttendanceWithSession[];
      const paymentRecords = (paymentsRes.data ?? []) as unknown as PaymentWithSession[];

      const byUser = new Map<string, AttendanceWithSession[]>();
      for (const r of records) {
        if (!r.sessions?.scheduled_at) continue;
        const list = byUser.get(r.user_id) ?? [];
        list.push(r);
        byUser.set(r.user_id, list);
      }

      const paymentsByUser = new Map<string, PaymentWithSession[]>();
      for (const p of paymentRecords) {
        const list = paymentsByUser.get(p.payer_id) ?? [];
        list.push(p);
        paymentsByUser.set(p.payer_id, list);
      }

      const computed = members.map((m): LeaderboardEntry => {
        const rows = (byUser.get(m.user_id) ?? []).sort(
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

        const paymentRows = paymentsByUser.get(m.user_id) ?? [];
        const paymentTotal = paymentRows.length;
        const paymentPaid = paymentRows.filter((p) => p.status === "paid").length;

        return {
          userId: m.user_id,
          name: m.users?.name ?? "Unknown",
          total,
          attended,
          pct: total > 0 ? Math.round((attended / total) * 100) : 0,
          streak,
          paymentTotal,
          paymentPaid,
          paymentPct: paymentTotal > 0 ? Math.round((paymentPaid / paymentTotal) * 100) : null,
        };
      });

      setEntries(computed);
      setLoading(false);
    });
  }, [user, supabase, groupId]);

  if (isLoading || !user || loading) return null;

  const sorted = [...entries].sort((a, b) => {
    if (tab === "streak") return b.streak - a.streak || b.pct - a.pct;
    if (tab === "attendance") return b.pct - a.pct || b.total - a.total;
    return (b.paymentPct ?? -1) - (a.paymentPct ?? -1) || b.paymentPaid - a.paymentPaid;
  });

  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  // Podium display order: 2nd, 1st, 3rd — heights staggered around the winner.
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardEntry[];

  return (
    <main className="min-h-screen bg-night p-6">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <Link
            href={`/groups/${groupId}`}
            className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim hover:text-chalk"
          >
            ← Back
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-chalk">
            {groupName} <span className="text-chalk-dim">Leaderboard</span>
          </h1>
        </div>

        <div className="flex border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 pb-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                tab === t.id ? "text-chalk" : "text-chalk-dim hover:text-chalk"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <motion.span
                  layoutId="tab-underline"
                  className="absolute -bottom-px left-0 right-0 h-0.5 bg-floodlight"
                />
              )}
            </button>
          ))}
        </div>

        {entries.length === 0 ? (
          <p className="font-mono text-xs uppercase tracking-wider text-chalk-dim">
            No attendance data yet.
          </p>
        ) : (
          <>
            {podium.length > 0 && (
              <div
                className={`grid items-end gap-3 ${
                  podiumOrder.length === 3 ? "grid-cols-3" : podiumOrder.length === 2 ? "grid-cols-2" : "grid-cols-1"
                }`}
              >
                {podiumOrder.map((e) => {
                  const rank = sorted.indexOf(e) + 1;
                  const isFirst = rank === 1;
                  return (
                    <motion.div
                      key={e.userId}
                      initial={hasAnimated ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: hasAnimated ? 0 : rank * 0.06 }}
                      className={`relative flex flex-col items-center rounded-xl border bg-turf px-2 text-center ${
                        isFirst
                          ? "border-floodlight/40 pb-5 pt-6"
                          : rank === 2
                          ? "border-line pb-4 pt-5"
                          : "border-line pb-3 pt-4"
                      }`}
                    >
                      <div className="relative">
                        {isFirst && (
                          <span className="pointer-events-none absolute -inset-3 rounded-full bg-floodlight/25 blur-lg" />
                        )}
                        <span
                          className={`relative flex items-center justify-center rounded-full bg-turf-raised font-semibold text-chalk ${
                            isFirst ? "h-14 w-14 text-base" : "h-11 w-11 text-sm"
                          }`}
                        >
                          {initials(e.name)}
                        </span>
                      </div>
                      <p className="mt-2 w-full truncate text-xs text-chalk">{e.name}</p>
                      <p
                        className={`mt-1 font-bold tracking-tight text-chalk ${
                          isFirst ? "text-2xl" : "text-lg"
                        }`}
                      >
                        {statFor(e, tab)}
                      </p>
                      <p className="font-mono text-[10px] text-chalk-dim">#{rank}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {rest.length > 0 && (
              <ul className="space-y-2">
                {rest.map((e, i) => (
                  <motion.li
                    key={e.userId}
                    initial={hasAnimated ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: hasAnimated ? 0 : 0.2 + i * 0.03 }}
                    className="flex items-center gap-3 rounded-lg border border-line bg-turf px-3 py-2.5"
                  >
                    <span className="w-6 font-mono text-xs text-chalk-dim">{i + 4}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-turf-raised text-[11px] font-semibold text-chalk">
                      {initials(e.name)}
                    </span>
                    <span className="flex-1 truncate text-sm text-chalk">{e.name}</span>
                    <span className="text-lg font-bold tracking-tight text-chalk">
                      {statFor(e, tab)}
                    </span>
                  </motion.li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
