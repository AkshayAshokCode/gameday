"use client";

import { useState } from "react";

// Overlapping initials-circle rail for confirmed players. Quiet by design —
// the rail communicates "who's in" at a glance; tapping it expands to the
// full list of names (and tapping again collapses back).
export function AvatarRail({ names, max = 6 }: { names: string[]; max?: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;

  if (names.length === 0) return null;

  function toggle(e: React.MouseEvent) {
    // The rail often sits inside a fully-clickable card (group hero) —
    // expanding must not also trigger the card's navigation.
    e.stopPropagation();
    setExpanded((v) => !v);
  }

  if (expanded) {
    return (
      <div
        role="button"
        aria-expanded="true"
        onClick={toggle}
        className="flex cursor-pointer flex-wrap gap-1.5"
      >
        {names.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="rounded-full border border-line bg-turf-raised px-2.5 py-1.5 text-xs text-chalk"
          >
            {name}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      role="button"
      aria-expanded="false"
      onClick={toggle}
      title="Tap to see everyone"
      className="flex cursor-pointer items-center"
    >
      {shown.map((name, i) => (
        <div
          key={`${name}-${i}`}
          title={name}
          className="-ml-2 first:ml-0 flex h-9 w-9 items-center justify-center rounded-full bg-turf-raised text-xs font-semibold text-chalk ring-2 ring-night"
        >
          {name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("")}
        </div>
      ))}
      {overflow > 0 && (
        <div className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-night text-xs font-mono text-chalk-dim ring-2 ring-night border border-line">
          +{overflow}
        </div>
      )}
    </div>
  );
}
