"use client";

import { useRef, useState, type ReactNode } from "react";

// CRED-style hold-to-pay: the action only fires after an uninterrupted 600ms
// press, with a floodlight fill sweeping across as progress feedback. Prevents
// accidental self-reports and adds intentionality. (Plan calls for a filling
// ring; a pill-fill reads the same at this size and is steadier on mobile.)
// The fill is functional progress feedback, so it stays under reduced motion.
export function HoldToConfirm({
  onConfirm,
  disabled,
  duration = 600,
  // Destructive actions (e.g. delete session) get red chrome and a longer
  // default is set by the caller — the fill mechanics are identical.
  danger = false,
  children,
}: {
  onConfirm: () => void;
  disabled?: boolean;
  duration?: number;
  danger?: boolean;
  children: ReactNode;
}) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<number | null>(null);

  function start(e: React.PointerEvent) {
    if (disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setHolding(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setHolding(false);
      onConfirm();
    }, duration);
  }

  function cancel() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
  }

  return (
    <button
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled}
      className={`relative touch-none select-none overflow-hidden rounded-full border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50 ${
        danger
          ? "border-card-red/60 text-card-red hover:border-card-red"
          : "border-line text-chalk-dim hover:border-chalk-dim hover:text-chalk"
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-0 origin-left ${danger ? "bg-card-red/30" : "bg-floodlight/30"}`}
        style={{
          transform: holding ? "scaleX(1)" : "scaleX(0)",
          transition: holding
            ? `transform ${duration}ms linear`
            : "transform 120ms ease-out",
        }}
      />
      <span className="relative">{holding ? "Hold…" : children}</span>
    </button>
  );
}
