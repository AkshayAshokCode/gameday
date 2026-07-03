"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState, type ReactNode } from "react";

// Ceremony 1 (vote-in): a radial floodlight wash sweeps outward from the tap
// point (450ms, celebration overshoot ease) under a 12–16 particle burst in
// floodlight + chalk. Reduced motion skips both (confetti has it built in).
const CELEBRATION: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

export function useVoteCeremony(): {
  fire: (clientX: number, clientY: number) => void;
  overlay: ReactNode;
} {
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);

  const fire = useCallback((clientX: number, clientY: number) => {
    confetti({
      particleCount: 14,
      spread: 75,
      startVelocity: 24,
      gravity: 1.1,
      ticks: 100,
      scalar: 0.9,
      origin: { x: clientX / window.innerWidth, y: clientY / window.innerHeight },
      colors: ["#E8FF47", "#F2F5EF"],
      disableForReducedMotion: true,
    });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRipple({ x: clientX, y: clientY, key: Date.now() });
    }
  }, []);

  const overlay = (
    <AnimatePresence>
      {ripple && (
        <motion.span
          key={ripple.key}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: CELEBRATION }}
          onAnimationComplete={() => setRipple(null)}
          className="pointer-events-none fixed z-50 h-[480px] w-[480px] rounded-full"
          style={{
            left: ripple.x - 240,
            top: ripple.y - 240,
            background:
              "radial-gradient(circle, rgba(232,255,71,0.35) 0%, rgba(232,255,71,0) 70%)",
          }}
        />
      )}
    </AnimatePresence>
  );

  return { fire, overlay };
}
