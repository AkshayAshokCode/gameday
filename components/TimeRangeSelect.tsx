// Turf bookings run in half-hour slots, not arbitrary minutes — 6:00 AM to
// 11:30 PM covers realistic game times.
export const TIME_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export function formatTimeSlot(slot: string) {
  const [h, m] = slot.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// Start + end slot pickers for a booking range (e.g. 9:00 AM – 10:00 AM).
// Picking a start auto-suggests a 1-hour end (adjustable), and the end list
// only offers slots after the chosen start so an invalid range can't be built.
export function TimeRangeSelect({
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  const endOptions = TIME_SLOTS.filter((s) => s > start);

  function handleStartChange(v: string) {
    onStartChange(v);
    if (!end || end <= v) {
      const defaultEnd = TIME_SLOTS[TIME_SLOTS.indexOf(v) + 2]; // +1 hour
      onEndChange(defaultEnd ?? "");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        required
        value={start}
        onChange={(e) => handleStartChange(e.target.value)}
        className="flex-1 rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
      >
        <option value="">Start</option>
        {TIME_SLOTS.map((slot) => (
          <option key={slot} value={slot}>
            {formatTimeSlot(slot)}
          </option>
        ))}
      </select>
      <span className="font-mono text-xs text-chalk-dim">to</span>
      <select
        required
        disabled={!start}
        value={end}
        onChange={(e) => onEndChange(e.target.value)}
        className="flex-1 rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none disabled:opacity-50"
      >
        <option value="">End</option>
        {endOptions.map((slot) => (
          <option key={slot} value={slot}>
            {formatTimeSlot(slot)}
          </option>
        ))}
      </select>
    </div>
  );
}
