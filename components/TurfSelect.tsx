"use client";

interface TurfOption {
  id: string;
  name: string;
}

const baseCls =
  "rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none";

// Tiered turf picker shared by the new-session form and the session edit
// panel: "This group's turfs" (recently used ∪ explicitly saved) surfaces
// first since a group almost always books the same one every week, with the
// full global directory underneath.
export function TurfSelect({
  turfs,
  groupTurfIds,
  value,
  onChange,
  className = "",
  emptyLabel = "Not yet decided",
}: {
  turfs: TurfOption[];
  groupTurfIds: string[];
  value: string;
  onChange: (turfId: string) => void;
  className?: string;
  emptyLabel?: string;
}) {
  const groupTurfs = groupTurfIds
    .map((id) => turfs.find((t) => t.id === id))
    .filter((t): t is TurfOption => Boolean(t));
  const otherTurfs = turfs.filter((t) => !groupTurfIds.includes(t.id));

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${baseCls} ${className}`}>
      <option value="">{emptyLabel}</option>
      {groupTurfs.length > 0 && (
        <optgroup label="This group's turfs">
          {groupTurfs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
      )}
      {otherTurfs.length > 0 && (
        <optgroup label={groupTurfs.length > 0 ? "Other turfs" : "Turfs"}>
          {otherTurfs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
