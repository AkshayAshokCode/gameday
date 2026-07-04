"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

// Ceremony 2 — the Squad Reveal, the weekly climax. A face-down deck shuffles
// center-screen (~1.3s of visible mixing), then cards deal into the two team
// columns alternately (140ms stagger, spring settle + flip face-up), then the
// team names stamp in with a subtle screen shake. ~3.5s total. Tap once to
// skip to the end state, tap again to close — it never auto-dismisses, because
// this is the screenshot-and-share moment. Reduced motion jumps straight to
// the final state.
const CELEBRATION: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

type Phase = "shuffle" | "deal" | "stamp";

export function SquadRevealOverlay({
  teamA,
  teamB,
  emoji = "⚽",
  onClose,
}: {
  teamA: string[];
  teamB: string[];
  emoji?: string;
  onClose: () => void;
}) {
  const total = teamA.length + teamB.length;
  const [phase, setPhase] = useState<Phase>("shuffle");
  const [dealt, setDealt] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDealt(total);
      setPhase("stamp");
      return;
    }
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase("deal"), 1300));
    for (let i = 1; i <= total; i++) {
      timers.push(window.setTimeout(() => setDealt(i), 1300 + i * 140));
    }
    timers.push(window.setTimeout(() => setPhase("stamp"), 1300 + total * 140 + 500));
    return () => timers.forEach(clearTimeout);
  }, [total]);

  function handleTap() {
    if (phase !== "stamp") {
      setDealt(total);
      setPhase("stamp");
    } else {
      onClose();
    }
  }

  // Alternating deal (A, B, A, B…) for suspense.
  const aCount = Math.min(teamA.length, Math.ceil(dealt / 2));
  const bCount = Math.min(teamB.length, Math.floor(dealt / 2));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={handleTap}
      className="fixed inset-0 z-[100] cursor-pointer overflow-y-auto bg-night/[0.97] p-6"
    >
      <motion.div
        animate={phase === "stamp" ? { x: [0, -2, 2, -1, 0], y: [0, 1, -1, 0, 0] } : {}}
        transition={{ duration: 0.12 }}
        className="mx-auto max-w-md pt-12"
      >
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chalk-dim">
          {phase === "shuffle" ? "Shuffling…" : phase === "deal" ? "Dealing…" : "Squads locked"}
        </p>

        {phase === "shuffle" ? (
          <div className="relative mx-auto mt-14 h-36 w-24">
            {Array.from({ length: Math.min(total, 8) }).map((_, i) => (
              <motion.div
                key={i}
                style={{ zIndex: i }}
                animate={{
                  rotate: [i % 2 ? -6 : 5, i % 2 ? 7 : -8, i % 2 ? -4 : 3],
                  x: [0, i % 2 ? 12 : -14, 0],
                  y: [0, i % 3 ? -8 : 10, 0],
                }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 flex items-center justify-center rounded-xl border border-line bg-turf-raised shadow-lg"
              >
                <span className="text-lg">{emoji}</span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4">
            {(["A", "B"] as const).map((team) => {
              const names = team === "A" ? teamA : teamB;
              const count = team === "A" ? aCount : bCount;
              return (
                <div key={team}>
                  <div className="mb-3 h-7">
                    <AnimatePresence>
                      {phase === "stamp" && (
                        <motion.p
                          initial={{ scale: 1.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.25, ease: CELEBRATION }}
                          className="text-center text-xl font-bold tracking-tight text-floodlight"
                        >
                          TEAM {team}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  <ul className="space-y-2" style={{ perspective: 600 }}>
                    {names.slice(0, count).map((n) => (
                      <motion.li
                        key={n}
                        initial={{ opacity: 0, y: -28, rotateY: 180, scale: 0.7 }}
                        animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 320, damping: 24 }}
                        className="rounded-lg border border-line bg-turf px-3 py-2.5 text-center text-sm font-semibold text-chalk"
                      >
                        {n}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {phase === "stamp" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 text-center font-mono text-[11px] uppercase tracking-widest text-chalk-dim"
          >
            Tap to close
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}
