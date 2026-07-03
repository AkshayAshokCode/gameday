"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

// Ceremony 3 — streak milestone. Full-screen takeover when a member's own
// streak reaches a multiple of 5: jersey numeral scales 0.6→1 with overshoot,
// floodlight glow blooming behind, flame flicker, mono caption. Auto-dismisses
// in 2.5s or on tap. Shown to the member themselves (next visit after the
// organizer's marking pushed them there), deduped via localStorage so each
// milestone celebrates exactly once. Ordinary increments stay quiet.
const CELEBRATION: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

export function useStreakMilestone(entries: { key: string; streak: number }[]): {
  celebrating: { key: string; streak: number } | null;
  dismiss: () => void;
} {
  const [celebrating, setCelebrating] = useState<{ key: string; streak: number } | null>(null);

  const serialized = JSON.stringify(entries);
  useEffect(() => {
    const parsed: { key: string; streak: number }[] = JSON.parse(serialized);
    for (const e of parsed) {
      if (e.streak > 0 && e.streak % 5 === 0) {
        const seen = Number(localStorage.getItem(`gd_streak_seen:${e.key}`) ?? 0);
        if (e.streak > seen) {
          setCelebrating(e);
          return;
        }
      }
    }
  }, [serialized]);

  const dismiss = () => {
    if (celebrating) {
      localStorage.setItem(`gd_streak_seen:${celebrating.key}`, String(celebrating.streak));
    }
    setCelebrating(null);
  };

  return { celebrating, dismiss };
}

export function StreakMilestoneOverlay({
  celebrating,
  dismiss,
}: {
  celebrating: { key: string; streak: number } | null;
  dismiss: () => void;
}) {
  useEffect(() => {
    if (!celebrating) return;
    const t = setTimeout(dismiss, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrating]);

  return (
    <AnimatePresence>
      {celebrating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={dismiss}
          className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-night/95"
        >
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: CELEBRATION }}
            className="pointer-events-none absolute h-96 w-96 rounded-full bg-floodlight/15 blur-3xl"
          />
          <motion.p
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: CELEBRATION }}
            className="relative text-9xl font-bold tracking-tighter text-chalk"
          >
            {celebrating.streak}
          </motion.p>
          <motion.span
            animate={{ rotate: [0, -10, 8, -5, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="relative mt-2 text-5xl"
          >
            🔥
          </motion.span>
          <p className="relative mt-4 font-mono text-xs uppercase tracking-[0.25em] text-chalk-dim">
            {celebrating.streak} weeks. Never missed.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
