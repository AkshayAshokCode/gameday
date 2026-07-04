"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, useSupabase } from "@/lib/auth-context";
import { AvatarRail } from "@/components/AvatarRail";
import { CopyInviteLink } from "@/components/CopyInviteLink";
import { CountUp } from "@/components/CountUp";
import { NeoPopButton } from "@/components/NeoPopButton";
import { StreakMilestoneOverlay, useStreakMilestone } from "@/components/StreakMilestone";
import { sportEmoji } from "@/lib/sports";
import type { Database } from "@/lib/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type Session = Database["public"]["Tables"]["sessions"]["Row"];

interface HeroVote {
  user_id: string;
  voted_in: boolean;
  guest_count: number;
  users: { name: string } | null;
}

interface StreakRow {
  user_id: string;
  attended: boolean;
  sessions: { scheduled_at: string | null } | null;
}

interface MemberRow {
  user_id: string;
  users: { name: string } | null;
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatSlot(start: string, end: string | null) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const supabase = useSupabase();
  const [group, setGroup] = useState<Group | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [heroVotes, setHeroVotes] = useState<HeroVote[]>([]);
  const [heroWaitlisted, setHeroWaitlisted] = useState<string[]>([]);
  const [topStreaks, setTopStreaks] = useState<{ name: string; streak: number }[]>([]);
  const [myStreak, setMyStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const { celebrating, dismiss } = useStreakMilestone([{ key: groupId, streak: myStreak }]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const [groupRes, sessionsRes, membersRes, attendanceRes] = await Promise.all([
        supabase.from("groups").select("*").eq("id", groupId).single(),
        supabase
          .from("sessions")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false }),
        supabase.from("group_members").select("user_id, users(name)").eq("group_id", groupId),
        supabase
          .from("attendance")
          .select("user_id, attended, sessions!inner(scheduled_at, group_id)")
          .eq("sessions.group_id", groupId),
      ]);

      setGroup(groupRes.data);
      const sessionList = sessionsRes.data ?? [];
      setSessions(sessionList);

      // Hero = the latest still-active session, else the most recent one.
      const hero =
        sessionList.find((s) => s.status !== "completed") ?? sessionList[0] ?? null;

      if (hero) {
        const [votesRes, waitlistRes] = await Promise.all([
          supabase
            .from("session_votes")
            .select("user_id, voted_in, guest_count, users(name)")
            .eq("session_id", hero.id),
          supabase.from("session_waitlist").select("user_id").eq("session_id", hero.id),
        ]);
        setHeroVotes((votesRes.data ?? []) as unknown as HeroVote[]);
        setHeroWaitlisted((waitlistRes.data ?? []).map((w) => w.user_id));
      }

      // Streak preview: current run of attended sessions per member, top 3.
      const members = (membersRes.data ?? []) as unknown as MemberRow[];
      const records = (attendanceRes.data ?? []) as unknown as StreakRow[];
      const byUser = new Map<string, StreakRow[]>();
      for (const r of records) {
        if (!r.sessions?.scheduled_at) continue;
        const list = byUser.get(r.user_id) ?? [];
        list.push(r);
        byUser.set(r.user_id, list);
      }
      const streaks = members.map((m) => {
        const rows = (byUser.get(m.user_id) ?? []).sort(
          (a, b) =>
            new Date(a.sessions!.scheduled_at!).getTime() -
            new Date(b.sessions!.scheduled_at!).getTime()
        );
        let streak = 0;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].attended) streak++;
          else break;
        }
        return { userId: m.user_id, name: m.users?.name ?? "Unknown", streak };
      });
      setMyStreak(streaks.find((s) => s.userId === user.id)?.streak ?? 0);
      setTopStreaks(
        streaks
          .filter((s) => s.streak > 0)
          .sort((a, b) => b.streak - a.streak)
          .slice(0, 3)
      );

      setLoading(false);
    })();
  }, [user, supabase, groupId]);

  if (isLoading || !user || loading) return null;
  if (!group) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-night px-4">
        <p className="font-mono text-xs uppercase tracking-wider text-chalk-dim">
          Group not found, or you&apos;re not a member.
        </p>
      </main>
    );
  }

  const hero = sessions.find((s) => s.status !== "completed") ?? sessions[0] ?? null;
  const pastSessions = sessions.filter((s) => s.id !== hero?.id);

  const waitlistedIds = new Set(heroWaitlisted);
  const confirmed = heroVotes.filter((v) => v.voted_in && !waitlistedIds.has(v.user_id));
  const headcount = confirmed.reduce((sum, v) => sum + 1 + v.guest_count, 0);
  const iAmIn = confirmed.some((v) => v.user_id === user.id);

  const heroStatusLabel =
    hero?.status === "proposing"
      ? "Day poll live"
      : hero?.status === "open"
      ? "Poll open"
      : hero?.status === "locked"
      ? "Squads forming"
      : "Completed";

  const heroCta =
    hero?.status === "proposing"
      ? "PICK YOUR DAYS"
      : hero?.status === "open"
      ? iAmIn
        ? "YOU'RE IN — VIEW"
        : "I'M IN"
      : hero?.status === "locked"
      ? "VIEW SQUAD"
      : "VIEW SESSION";

  return (
    <main className="min-h-screen bg-night p-6">
      <StreakMilestoneOverlay celebrating={celebrating} dismiss={dismiss} />
      <div className="mx-auto max-w-md space-y-8">
        <div className="flex items-start justify-between pt-2">
          <div>
            <Link
              href="/"
              className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim hover:text-chalk"
            >
              ← Home
            </Link>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-chalk">
              {sportEmoji(group.sport)} {group.name}
            </h1>
            <CopyInviteLink code={group.invite_code} className="mt-2" />
          </div>
          {myStreak > 0 && (
            <div className="rounded-full border border-line bg-turf px-3 py-1.5 font-mono text-xs text-chalk">
              🔥 {myStreak}
            </div>
          )}
        </div>

        {hero ? (
          <div
            style={{ viewTransitionName: "session-hero" }}
            className="rounded-2xl border border-line bg-turf p-6 space-y-5"
          >
            <div className="flex items-center gap-2">
              {(hero.status === "open" || hero.status === "proposing") && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-floodlight" />
              )}
              <p className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
                {heroStatusLabel}
              </p>
            </div>

            <div>
              <p className="text-2xl font-bold tracking-tight text-chalk">
                {hero.status === "proposing" || !hero.scheduled_at
                  ? "Which day works?"
                  : formatDay(hero.scheduled_at)}
              </p>
              {hero.scheduled_at && hero.status !== "proposing" && (
                <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-chalk-dim">
                  {formatSlot(hero.scheduled_at, hero.ends_at)}
                </p>
              )}
            </div>

            {hero.status !== "proposing" && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
                  Confirmed
                </p>
                <p className="mt-1 text-6xl font-bold tracking-tighter text-chalk">
                  <CountUp value={headcount} />
                  <span className="ml-1.5 text-2xl font-semibold tracking-normal text-chalk-dim">
                    /{hero.max_capacity}
                  </span>
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-night">
                  <div
                    className="h-full w-full origin-left rounded-full bg-floodlight transition-transform duration-500 motion-reduce:transition-none"
                    style={{
                      transform: `scaleX(${Math.min(1, headcount / hero.max_capacity)})`,
                    }}
                  />
                </div>
              </div>
            )}

            {confirmed.length > 0 && (
              <AvatarRail names={confirmed.map((v) => v.users?.name ?? "?")} />
            )}

            <NeoPopButton
              className="w-full"
              onClick={() => router.push(`/groups/${groupId}/sessions/${hero.id}`)}
            >
              {heroCta}
            </NeoPopButton>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-turf p-6 text-center space-y-4">
            <p className="font-mono text-xs uppercase tracking-wider text-chalk-dim">
              No session this week. Start one.
            </p>
            <NeoPopButton
              onClick={() => router.push(`/groups/${groupId}/sessions/new`)}
            >
              NEW SESSION
            </NeoPopButton>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Leaderboard temporarily disabled — see leaderboard/page.tsx redirect. */}
            <Link
              href={`/groups/${groupId}/turfs`}
              className="font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk"
            >
              🏟️ Turfs
            </Link>
          </div>
          {hero && (
            <Link
              href={`/groups/${groupId}/sessions/new`}
              className="font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk"
            >
              + New session
            </Link>
          )}
        </div>

        {topStreaks.length > 0 && (
          <div className="rounded-xl border border-line bg-turf p-4 space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
              Top streaks
            </p>
            <ul className="space-y-1.5">
              {topStreaks.map((s, i) => (
                <li key={s.name + i} className="flex items-center justify-between">
                  <span className="text-sm text-chalk">
                    <span className="mr-2 font-mono text-xs text-chalk-dim">{i + 1}</span>
                    {s.name}
                  </span>
                  <span className="font-mono text-xs text-chalk">🔥 {s.streak}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pastSessions.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
              More sessions
            </p>
            <ul className="space-y-2">
              {pastSessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/groups/${groupId}/sessions/${s.id}`}
                    className="flex items-center justify-between rounded-lg border border-line px-4 py-3 transition-colors hover:border-chalk-dim"
                  >
                    <span className="text-sm text-chalk">
                      {s.status === "proposing" || !s.scheduled_at
                        ? "🗳️ Day poll"
                        : formatDay(s.scheduled_at)}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                      {s.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
