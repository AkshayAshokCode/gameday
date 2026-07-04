"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useAuth, useSupabase } from "@/lib/auth-context";
import { NeoPopButton } from "@/components/NeoPopButton";
import { NumberStepper } from "@/components/NumberStepper";
import { TimeRangeSelect } from "@/components/TimeRangeSelect";
import { TurfSelect } from "@/components/TurfSelect";
import { friendlyError } from "@/lib/errors";
import { SPORTS } from "@/lib/sports";
import type { Database } from "@/lib/supabase/types";

// Leaflet touches window/document directly, so it can't run during SSR.
const TurfLocationPicker = dynamic(() => import("@/components/TurfLocationPicker"), { ssr: false });

type Turf = Database["public"]["Tables"]["turfs"]["Row"];

export default function NewSessionPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const supabase = useSupabase();

  const [turfs, setTurfs] = useState<Turf[]>([]);
  // Turf ids this group has actually played at, most recent first — these
  // surface as the primary tier in the picker (turfs are global by design,
  // but a group almost always books the same one every week).
  const [groupTurfIds, setGroupTurfIds] = useState<string[]>([]);
  const [turfId, setTurfId] = useState("");
  const [addingTurf, setAddingTurf] = useState(false);
  const [newTurfName, setNewTurfName] = useState("");
  const [newTurfLat, setNewTurfLat] = useState<number | null>(null);
  const [newTurfLng, setNewTurfLng] = useState<number | null>(null);

  const [sport, setSport] = useState("");
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
  const [maxCapacityInput, setMaxCapacityInput] = useState("12");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    // Without this, the effect fires on first mount using an unauthenticated
    // client (the token hasn't loaded from storage yet) — RLS blocks the
    // .single() group query with a 406, which then "fixes itself" once
    // useSupabase() re-memoizes on the real token. Waiting avoids the
    // failed round-trip and the console error entirely.
    if (!user) return;

    (async () => {
      const [turfsRes, usedRes, savedRes, groupRes] = await Promise.all([
        supabase.from("turfs").select("*").order("name"),
        supabase
          .from("sessions")
          .select("turf_id, created_at")
          .eq("group_id", groupId)
          .not("turf_id", "is", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("group_turfs")
          .select("turf_id")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false }),
        supabase.from("groups").select("sport").eq("id", groupId).single(),
      ]);

      // Sessions default to the group's sport; still switchable per session.
      setSport((prev) => prev || groupRes.data?.sport || "football");

      const list = turfsRes.data ?? [];
      setTurfs(list);

      // Group tier = recently used ∪ explicitly saved (history first).
      const seen = new Set<string>();
      const ordered: string[] = [];
      for (const s of usedRes.data ?? []) {
        if (s.turf_id && !seen.has(s.turf_id)) {
          seen.add(s.turf_id);
          ordered.push(s.turf_id);
        }
      }
      for (const g of savedRes.data ?? []) {
        if (!seen.has(g.turf_id)) {
          seen.add(g.turf_id);
          ordered.push(g.turf_id);
        }
      }
      setGroupTurfIds(ordered);

      if (list.length === 0) setAddingTurf(true);
      // Default to the group's most recent turf — the weekly ritual is
      // usually the same booking, so don't make the organizer re-pick.
      else if (ordered.length > 0) setTurfId((prev) => prev || ordered[0]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, groupId]);

  async function handleAddTurf() {
    if (!newTurfName.trim()) return;
    const { data, error: turfError } = await supabase
      .from("turfs")
      .insert({
        name: newTurfName.trim(),
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

    // A turf added while organizing is this group's turf — save the link so
    // it lands in the primary tier next time (best-effort).
    await supabase
      .from("group_turfs")
      .insert({ group_id: groupId, turf_id: data.id, added_by: user?.id });

    setTurfs((prev) => [...prev, data]);
    setGroupTurfIds((prev) => [data.id, ...prev]);
    setTurfId(data.id);
    setAddingTurf(false);
    setNewTurfName("");
    setNewTurfLat(null);
    setNewTurfLng(null);
  }

  // Chrome only opens the calendar when the tiny indicator icon is clicked;
  // this makes the whole field do it. Safari <16 lacks showPicker — the icon
  // still works there.
  function openPicker(e: React.MouseEvent<HTMLInputElement>) {
    try {
      e.currentTarget.showPicker?.();
    } catch {
      // Needs user activation; a click always has it, but stay defensive.
    }
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
          sport: sport || null,
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
    } catch (err) {
      setError(friendlyError(err, "Couldn't create the session. Try again."));
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !user) return null;

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
            <p className="block font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
              Sport
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SPORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSport(s.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    sport === s.id
                      ? "bg-floodlight text-night"
                      : "border border-line text-chalk-dim hover:text-chalk"
                  }`}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-widest text-chalk-dim">Turf</label>

            {turfs.length > 0 && !addingTurf && (
              <TurfSelect
                turfs={turfs}
                groupTurfIds={groupTurfIds}
                value={turfId}
                onChange={setTurfId}
                className="mt-1 block w-full"
              />
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
                  onClick={openPicker}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="block w-full cursor-pointer rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
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
                      onClick={openPicker}
                      onChange={(e) => updateDayOption(i, e.target.value)}
                      className="block w-full cursor-pointer rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
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
            <p className="block font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
              Max capacity
            </p>
            <NumberStepper
              value={maxCapacityInput}
              onChange={setMaxCapacityInput}
              min={1}
              className="mt-1.5"
            />
          </div>

          {error && <p className="text-sm text-card-red">{error}</p>}

          <NeoPopButton type="submit" className="w-full" loading={saving}>
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
