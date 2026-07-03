"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useAuth, useSupabase } from "@/lib/auth-context";
import { NeoPopButton } from "@/components/NeoPopButton";
import type { Database } from "@/lib/supabase/types";

// Leaflet touches window/document directly, so it can't run during SSR.
const TurfLocationPicker = dynamic(() => import("@/components/TurfLocationPicker"), { ssr: false });

type Turf = Database["public"]["Tables"]["turfs"]["Row"];

// Turf bookings run in half-hour slots, not arbitrary minutes — 6:00 AM to
// 11:30 PM covers realistic game times.
const TIME_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

function formatTimeSlot(slot: string) {
  const [h, m] = slot.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// Start + end slot pickers for a booking range (e.g. 9:00 AM – 10:00 AM).
// Picking a start auto-suggests a 1-hour end (adjustable), and the end list
// only offers slots after the chosen start so an invalid range can't be built.
function TimeRangeSelect({
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

export default function NewSessionPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useSupabase();

  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [turfId, setTurfId] = useState("");
  const [addingTurf, setAddingTurf] = useState(false);
  const [newTurfName, setNewTurfName] = useState("");
  const [newTurfAddress, setNewTurfAddress] = useState("");
  const [newTurfLat, setNewTurfLat] = useState<number | null>(null);
  const [newTurfLng, setNewTurfLng] = useState<number | null>(null);

  const [dateMode, setDateMode] = useState<"single" | "poll">("single");
  const [singleDate, setSingleDate] = useState("");
  const [singleStart, setSingleStart] = useState("");
  const [singleEnd, setSingleEnd] = useState("");
  const [dayOptions, setDayOptions] = useState(["", ""]);
  const [pollStart, setPollStart] = useState("");
  const [pollEnd, setPollEnd] = useState("");
  // Kept as raw text (not number) so the field can go fully empty while the
  // user is backspacing — coercing to Number on every keystroke would force
  // a "0" back in immediately and block clearing it.
  const [maxCapacityInput, setMaxCapacityInput] = useState("20");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("turfs")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setTurfs(data ?? []);
        if (!data || data.length === 0) setAddingTurf(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function handleAddTurf() {
    if (!newTurfName.trim()) return;
    const { data, error: turfError } = await supabase
      .from("turfs")
      .insert({
        name: newTurfName.trim(),
        address: newTurfAddress.trim() || null,
        lat: newTurfLat,
        lng: newTurfLng,
        default_capacity: Number(maxCapacityInput) || 0,
        added_by: user?.id,
      })
      .select()
      .single();

    if (turfError || !data) {
      setError("Failed to add turf");
      return;
    }

    setTurfs((prev) => [...prev, data]);
    setTurfId(data.id);
    setAddingTurf(false);
    setNewTurfName("");
    setNewTurfAddress("");
    setNewTurfLat(null);
    setNewTurfLng(null);
  }

  function updateDayOption(index: number, value: string) {
    setDayOptions((prev) => prev.map((d, i) => (i === index ? value : d)));
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (dateMode === "single" && (!singleDate || !singleStart || !singleEnd)) {
      setError("Pick a date and time slot");
      return;
    }

    const validDayOptions = dayOptions.map((d) => d.trim()).filter(Boolean);
    if (dateMode === "poll" && validDayOptions.length < 2) {
      setError("Add at least 2 candidate days, or switch to \"One day\"");
      return;
    }
    if (dateMode === "poll" && (!pollStart || !pollEnd)) {
      setError("Set a time slot — it applies to whichever day wins");
      return;
    }

    setSaving(true);
    try {
      const { data, error: insertError } = await supabase
        .from("sessions")
        .insert({
          group_id: groupId,
          organizer_id: user!.id,
          turf_id: turfId || null,
          scheduled_at:
            dateMode === "single" ? new Date(`${singleDate}T${singleStart}`).toISOString() : null,
          ends_at:
            dateMode === "single" ? new Date(`${singleDate}T${singleEnd}`).toISOString() : null,
          max_capacity: Number(maxCapacityInput) || 0,
          status: dateMode === "poll" ? "proposing" : "open",
        })
        .select()
        .single();

      if (insertError || !data) throw new Error(insertError?.message ?? "Failed to create session");

      if (dateMode === "poll") {
        const { error: optionsError } = await supabase.from("session_day_options").insert(
          validDayOptions.map((d) => ({
            session_id: data.id,
            scheduled_at: new Date(`${d}T${pollStart}`).toISOString(),
            ends_at: new Date(`${d}T${pollEnd}`).toISOString(),
          }))
        );
        if (optionsError) throw new Error(optionsError.message);
      }

      router.replace(`/groups/${groupId}/sessions/${data.id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to create session");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-night px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-chalk">New session</h1>
          <p className="mt-1 text-sm text-chalk-dim">
            Pick a date and capacity — turf can be decided later.
          </p>
        </div>

        <form onSubmit={handleCreateSession} className="space-y-4">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-widest text-chalk-dim">Turf</label>

            {turfs.length > 0 && !addingTurf && (
              <select
                value={turfId}
                onChange={(e) => setTurfId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
              >
                <option value="">Not yet decided</option>
                {turfs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}

            {!addingTurf ? (
              <button
                type="button"
                onClick={() => setAddingTurf(true)}
                className="mt-2 font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk"
              >
                + Add a different turf
              </button>
            ) : (
              <div className="mt-2 space-y-2 rounded-xl border border-line bg-turf p-3">
                <input
                  type="text"
                  placeholder="Turf name"
                  value={newTurfName}
                  onChange={(e) => setNewTurfName(e.target.value)}
                  className="block w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Address (optional)"
                  value={newTurfAddress}
                  onChange={(e) => setNewTurfAddress(e.target.value)}
                  className="block w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
                />
                <TurfLocationPicker
                  lat={newTurfLat}
                  lng={newTurfLng}
                  onChange={(lat, lng) => {
                    setNewTurfLat(lat);
                    setNewTurfLng(lng);
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddTurf}
                    className="rounded-lg border border-line bg-turf-raised px-3 py-1.5 text-xs font-semibold text-chalk transition-colors hover:border-chalk-dim"
                  >
                    Save turf
                  </button>
                  {turfs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddingTurf(false)}
                      className="font-mono text-xs uppercase text-chalk-dim hover:text-chalk"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-widest text-chalk-dim">Date &amp; time</label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setDateMode("single")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  dateMode === "single"
                    ? "bg-floodlight text-night"
                    : "border border-line text-chalk-dim hover:text-chalk"
                }`}
              >
                One day
              </button>
              <button
                type="button"
                onClick={() => setDateMode("poll")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  dateMode === "poll"
                    ? "bg-floodlight text-night"
                    : "border border-line text-chalk-dim hover:text-chalk"
                }`}
              >
                Let the group vote
              </button>
            </div>

            {dateMode === "single" ? (
              <div className="mt-2 space-y-2">
                <input
                  type="date"
                  required
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="block w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
                />
                <TimeRangeSelect
                  start={singleStart}
                  end={singleEnd}
                  onStartChange={setSingleStart}
                  onEndChange={setSingleEnd}
                />
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <div className="space-y-2">
                  {dayOptions.map((d, i) => (
                    <input
                      key={i}
                      type="date"
                      value={d}
                      onChange={(e) => updateDayOption(i, e.target.value)}
                      className="block w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
                    />
                  ))}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDayOptions((prev) => [...prev, ""])}
                      className="font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk"
                    >
                      + Add another day
                    </button>
                    {dayOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setDayOptions((prev) => prev.slice(0, -1))}
                        className="font-mono text-xs uppercase text-chalk-dim hover:text-chalk"
                      >
                        Remove last
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                    Time slot (same for every candidate day)
                  </label>
                  <div className="mt-1">
                    <TimeRangeSelect
                      start={pollStart}
                      end={pollEnd}
                      onStartChange={setPollStart}
                      onEndChange={setPollEnd}
                    />
                  </div>
                </div>

                <p className="text-xs text-chalk-dim">
                  The group votes on which day works; capacity and turf below apply to
                  whichever day wins.
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="maxCapacity" className="block font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
              Max capacity
            </label>
            <input
              id="maxCapacity"
              type="number"
              min={1}
              required
              value={maxCapacityInput}
              onChange={(e) => setMaxCapacityInput(e.target.value)}
              onBlur={() => {
                if (maxCapacityInput.trim() === "") setMaxCapacityInput("0");
              }}
              className="mt-1 block w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-card-red">{error}</p>}

          <NeoPopButton type="submit" className="w-full" disabled={saving}>
            {saving ? "CREATING…" : "CREATE SESSION"}
          </NeoPopButton>

          <button
            type="button"
            onClick={() => router.push(`/groups/${groupId}`)}
            className="w-full font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk"
          >
            ← Cancel
          </button>
        </form>
      </div>
    </main>
  );
}
