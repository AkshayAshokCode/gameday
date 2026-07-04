"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

// NeoPOP-style button ("turf-line painted block"): a solid offset shadow sits
// beneath-right, and on press the button translates INTO it — the shadow
// collapses to 1px so the button physically depresses. 90ms, every button.
// Primary = the one floodlight-yellow action a screen is allowed.

type Variant = "primary" | "secondary" | "danger";
type Size = "sm" | "md" | "lg";

interface NeoPopButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  // In-flight request feedback: keeps full brightness (unlike disabled) and
  // spins the sport's ball next to the label. The button still ignores clicks.
  loading?: boolean;
  // The sport glyph to spin while loading (defaults to football).
  spinner?: string;
}

const base =
  "inline-flex items-center justify-center rounded-lg font-semibold select-none " +
  "transition-all duration-[90ms] ease-out " +
  "disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-floodlight text-night shadow-[4px_4px_0_0_var(--floodlight-shadow)] " +
    "active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_0_var(--floodlight-shadow)]",
  secondary:
    "bg-transparent text-chalk border-[1.5px] border-chalk-dim " +
    "active:translate-x-[3px] active:translate-y-[3px] active:border-chalk active:shadow-[0_0_12px_rgba(242,245,239,0.15)]",
  danger:
    "bg-transparent text-card-red border-[1.5px] border-card-red/60 " +
    "active:translate-x-[3px] active:translate-y-[3px] active:border-card-red active:shadow-[0_0_12px_rgba(255,77,77,0.2)]",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export const NeoPopButton = forwardRef<HTMLButtonElement, NeoPopButtonProps>(
  function NeoPopButton(
    {
      variant = "primary",
      size = "md",
      loading = false,
      spinner = "⚽",
      className = "",
      children,
      disabled,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${
          loading ? "" : "disabled:opacity-50"
        } ${className}`}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="animate-spin motion-reduce:animate-none" aria-hidden>
              {spinner}
            </span>
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);
