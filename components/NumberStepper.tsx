"use client";

// Replaces the native number input's +/- spinner (invisible-but-clickable
// in Safari's dark mode) with our own. Value stays a string, same as every
// other numeric field in the app — see maxCapacityInput in the new-session
// page for why: coercing to Number on every keystroke blocks clearing the
// field while typing.
export function NumberStepper({
  value,
  onChange,
  min = 0,
  step = 1,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  min?: number;
  step?: number;
  className?: string;
}) {
  const current = Number(value) || 0;

  function adjust(delta: number) {
    onChange(String(Math.max(min, current + delta)));
  }

  return (
    <div
      className={`inline-flex items-stretch overflow-hidden rounded-lg border border-line bg-night ${className}`}
    >
      <button
        type="button"
        onClick={() => adjust(-step)}
        disabled={current <= min}
        className="px-3 text-lg font-semibold text-chalk-dim transition-colors hover:bg-turf-raised hover:text-chalk disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={() => {
          if (value.trim() === "") onChange(String(min));
        }}
        className="w-12 border-x border-line bg-night text-center text-sm text-chalk focus:outline-none"
      />
      <button
        type="button"
        onClick={() => adjust(step)}
        className="px-3 text-lg font-semibold text-chalk-dim transition-colors hover:bg-turf-raised hover:text-chalk"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
