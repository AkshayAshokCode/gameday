"use client";

import { MotionConfig } from "motion/react";
import * as React from "react";
import type { ComponentType, ReactNode } from "react";

// Page-to-page navigation runs through the browser's View Transitions API
// (Next.js experimental flag): default cross-fade everywhere, plus true
// shared-element morphs wherever two routes give an element the same
// view-transition-name (e.g. the hero session card → session detail header).
// unstable_ViewTransition ships in Next's bundled React canary but isn't in
// @types/react yet, hence the runtime lookup with a plain-fragment fallback.
// MotionConfig reducedMotion="user" makes every motion animation in the app
// (ceremonies included) collapse to opacity-only under prefers-reduced-motion;
// the view-transition equivalent lives in globals.css.
const ViewTransition: ComponentType<{ children: ReactNode }> =
  (React as unknown as { unstable_ViewTransition?: ComponentType<{ children: ReactNode }> })
    .unstable_ViewTransition ?? (({ children }) => <>{children}</>);

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ViewTransition>{children}</ViewTransition>
    </MotionConfig>
  );
}
