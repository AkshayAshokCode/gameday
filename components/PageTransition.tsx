"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Every route change gets a quick fade + slide instead of an instant, jarring
// swap. Keyed by pathname so AnimatePresence knows when to run exit/enter.
// MotionConfig reducedMotion="user" makes every motion animation in the app
// (ceremonies included) collapse to opacity-only under prefers-reduced-motion.
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
