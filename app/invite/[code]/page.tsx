"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { AvatarRail } from "@/components/AvatarRail";
import { friendlyError } from "@/lib/errors";
import { NeoPopButton } from "@/components/NeoPopButton";

// Ceremony 5 — joining a group. The invite link IS the growth mechanism, so
// this screen carries the first impression: group name in huge display type
// over a slow-panning turf texture, the member rail, one JOIN THE SQUAD
// action. On join the rail admits the new member and a WELCOME card stamps in.
const CELEBRATION: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

interface GroupPreview {
  id: string;
  name: string;
  sport: string;
}

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, accessToken, isLoading } = useAuth();
  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${code}`)
      .then(async (res) => {
        if (!res.ok) {
          const { error: msg } = await res.json();
          throw new Error(msg);
        }
        return res.json();
      })
      .then(({ group, memberNames, memberCount }) => {
        setGroup(group);
        setMemberNames(memberNames ?? []);
        setMemberCount(memberCount ?? 0);
      })
      .catch((err) =>
        setError(friendlyError(err, "This invite link doesn't seem to work. Ask for a fresh one."))
      );
  }, [code]);

  // After the welcome stamp, carry them into the group.
  useEffect(() => {
    if (!joined || !group) return;
    const t = setTimeout(() => router.replace(`/groups/${group.id}`), 2600);
    return () => clearTimeout(t);
  }, [joined, group, router]);

  function handleLoginRedirect() {
    sessionStorage.setItem("post_login_redirect", `/invite/${code}`);
    router.push("/login");
  }

  async function handleJoin() {
    setError("");
    setJoining(true);
    try {
      const res = await fetch(`/api/invite/${code}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg);
      }

      // The rail parts to admit the new member.
      if (user && !memberNames.includes(user.name)) {
        setMemberNames((prev) => [user.name, ...prev]);
        setMemberCount((c) => c + 1);
      }
      setJoined(true);
    } catch (err) {
      setError(friendlyError(err, "Couldn't join right now. Try again."));
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="turf-texture min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12 text-center">
        {error && (
          <p className="font-mono text-xs uppercase tracking-wider text-card-red">{error}</p>
        )}

        {!error && !group && (
          <p className="font-mono text-xs uppercase tracking-widest text-chalk-dim">
            Loading invite…
          </p>
        )}

        {group && (
          <>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-[11px] uppercase tracking-[0.3em] text-chalk-dim"
            >
              You&apos;re invited
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mt-3 text-5xl font-bold leading-tight tracking-tighter text-chalk"
            >
              {group.name}
            </motion.h1>

            {memberNames.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.16 }}
                className="mt-6 flex flex-col items-center gap-2"
              >
                <motion.div layout>
                  <AvatarRail names={memberNames} max={7} />
                </motion.div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                  {memberCount} member{memberCount === 1 ? "" : "s"}
                </p>
              </motion.div>
            )}

            <div className="mt-10 w-full">
              <AnimatePresence mode="wait">
                {joined ? (
                  <motion.div
                    key="welcome"
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, ease: CELEBRATION }}
                    className="rounded-2xl border border-floodlight/50 bg-turf px-6 py-8"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-chalk-dim">
                      Welcome to
                    </p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-floodlight">
                      {group.name}
                    </p>
                    <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
                      Taking you in…
                    </p>
                  </motion.div>
                ) : isLoading ? null : user ? (
                  <motion.div key="join" exit={{ opacity: 0, y: -8 }}>
                    <NeoPopButton
                      size="lg"
                      className="w-full"
                      onClick={handleJoin}
                      loading={joining}
                    >
                      {joining ? "JOINING…" : "JOIN THE SQUAD"}
                    </NeoPopButton>
                  </motion.div>
                ) : (
                  <motion.div key="login" exit={{ opacity: 0, y: -8 }}>
                    <NeoPopButton size="lg" className="w-full" onClick={handleLoginRedirect}>
                      LOG IN TO JOIN
                    </NeoPopButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
