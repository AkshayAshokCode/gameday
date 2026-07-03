// Overlapping initials-circle rail for confirmed players. Quiet by design —
// the rail communicates "who's in" at a glance without a full list.
export function AvatarRail({ names, max = 6 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;

  if (names.length === 0) return null;

  return (
    <div className="flex items-center">
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
