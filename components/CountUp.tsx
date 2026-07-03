"use client";

import { useEffect, useRef, useState } from "react";

// Numbers never jump (motion system rule): every numeral change animates via
// rAF count-up/down with a cubic ease-out. First mount counts up from 0 so
// hero numerals get an entrance. Reduced motion → instant set.
//
// The ref tracks the currently-displayed value (updated per frame), NOT the
// last target — mutating a "previous target" ref inside the effect breaks
// under StrictMode's double-invoke (second run sees from === to and bails,
// freezing the display).
export function CountUp({
  value,
  duration = 400,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      displayRef.current = to;
      setDisplay(to);
      return;
    }

    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      displayRef.current = current;
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
