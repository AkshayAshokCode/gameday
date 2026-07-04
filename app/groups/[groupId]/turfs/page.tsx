"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, useSupabase } from "@/lib/auth-context";
import { friendlyError } from "@/lib/errors";

// Leaflet touches window/document directly, so it can't run during SSR.
const TurfLocationPicker = dynamic(() => import("@/components/TurfLocationPicker"), { ssr: false });

interface TurfInfo {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
}

const inputCls =
  "block w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none";

export default function GroupTurfsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const supabase = useSupabase();

  const [groupName, setGroupName] = useState("");
  const [savedTurfs, setSavedTurfs] = useState<TurfInfo[]>([]);
  const [historyTurfs, setHistoryTurfs] = useState<TurfInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const [groupRes, linksRes, historyRes] = await Promise.all([
      supabase.from("groups").select("name").eq("id", groupId).single(),
      supabase
        .from("group_turfs")
        .select("turf_id, turfs(id, name, lat, lng)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
      supabase
        .from("sessions")
        .select("turf_id, turfs(id, name, lat, lng)")
        .eq("group_id", groupId)
        .not("turf_id", "is", null),
    ]);

    setGroupName(groupRes.data?.name ?? "");

    const saved = (linksRes.data ?? [])
      .map((l) => (l as unknown as { turfs: TurfInfo | null }).turfs)
      .filter((t): t is TurfInfo => Boolean(t));
    setSavedTurfs(saved);

    const savedIds = new Set(saved.map((t) => t.id));
    const seen = new Set<string>();
    const history: TurfInfo[] = [];
    for (const row of historyRes.data ?? []) {
      const t = (row as unknown as { turfs: TurfInfo | null }).turfs;
      if (t && !savedIds.has(t.id) && !seen.has(t.id)) {
        seen.add(t.id);
        history.push(t);
      }
    }
    setHistoryTurfs(history);
    setLoading(false);
  }, [supabase, groupId]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, loadData]);

  async function handleAdd() {
    if (!name.trim()) return;
    setError("");
    setSaving(true);
    try {
      const { data: turf, error: turfError } = await supabase
        .from("turfs")
        .insert({
          name: name.trim(),
          lat,
          lng,
          added_by: user?.id,
        })
        .select()
        .single();
      if (turfError || !turf) throw new Error(turfError?.message ?? "Failed to add turf");

      const { error: linkError } = await supabase
        .from("group_turfs")
        .insert({ group_id: groupId, turf_id: turf.id, added_by: user?.id });
      if (linkError) throw new Error(linkError.message);

      setName("");
      setLat(null);
      setLng(null);
      setAdding(false);
      await loadData();
    } catch (err) {
      setError(friendlyError(err, "Couldn't add the turf. Try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveExisting(turfId: string) {
    await supabase
      .from("group_turfs")
      .insert({ group_id: groupId, turf_id: turfId, added_by: user?.id });
    await loadData();
  }

  async function handleRemove(turfId: string) {
    await supabase.from("group_turfs").delete().eq("group_id", groupId).eq("turf_id", turfId);
    await loadData();
  }

  if (isLoading || !user || loading) return null;

  return (
    <main className="min-h-screen bg-night p-6">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <Link
            href={`/groups/${groupId}`}
            className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim hover:text-chalk"
          >
            ← {groupName || "Back"}
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-chalk">Turfs</h1>
          <p className="mt-1 text-sm text-chalk-dim">
            Save the turfs your group plays at — they show first when creating a session.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
              Saved · {savedTurfs.length}
            </p>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="font-mono text-xs uppercase tracking-wider text-floodlight hover:opacity-80"
              >
                + Add turf
              </button>
            )}
          </div>

          {adding && (
            <div className="space-y-2 rounded-xl border border-line bg-turf p-3">
              <input
                type="text"
                placeholder="Turf name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
              <TurfLocationPicker
                lat={lat}
                lng={lng}
                onChange={(la, ln) => {
                  setLat(la);
                  setLng(ln);
                }}
              />
              {error && <p className="text-sm text-card-red">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving || !name.trim()}
                  className="rounded-lg border border-line bg-turf-raised px-3 py-1.5 text-xs font-semibold text-chalk transition-colors hover:border-chalk-dim disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save turf"}
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="font-mono text-xs uppercase text-chalk-dim hover:text-chalk"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {savedTurfs.length === 0 && !adding ? (
            <p className="font-mono text-xs uppercase tracking-wider text-chalk-dim/70">
              No turfs saved yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {savedTurfs.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-turf px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-chalk">{t.name}</p>
                    {t.lat != null && t.lng != null && (
                      <p className="truncate font-mono text-[11px] text-chalk-dim">
                        <a
                          href={`https://www.google.com/maps?q=${t.lat},${t.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-floodlight hover:opacity-80"
                        >
                          📍 Map
                        </a>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(t.id)}
                    title="Remove from this group's list"
                    className="font-mono text-xs text-chalk-dim hover:text-card-red"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {historyTurfs.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
              From past sessions
            </p>
            <ul className="space-y-2">
              {historyTurfs.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line/50 px-3 py-2.5 opacity-70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-chalk">{t.name}</p>
                    {t.lat != null && t.lng != null && (
                      <p className="truncate font-mono text-[11px] text-chalk-dim">
                        <a
                          href={`https://www.google.com/maps?q=${t.lat},${t.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-floodlight hover:opacity-80"
                        >
                          📍 Map
                        </a>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSaveExisting(t.id)}
                    className="shrink-0 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-chalk-dim transition-colors hover:border-chalk-dim hover:text-chalk"
                  >
                    Save
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
