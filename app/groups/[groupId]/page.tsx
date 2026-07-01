"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, useSupabase } from "@/lib/auth-context";
import type { Database } from "@/lib/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type Session = Database["public"]["Tables"]["sessions"]["Row"];

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const supabase = useSupabase();
  const [group, setGroup] = useState<Group | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase
        .from("sessions")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
    ]).then(([groupRes, sessionsRes]) => {
      setGroup(groupRes.data);
      setSessions(sessionsRes.data ?? []);
      setLoading(false);
    });
  }, [user, supabase, groupId]);

  if (isLoading || !user || loading) return null;
  if (!group) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <p className="text-sm text-gray-500">
          Group not found, or you&apos;re not a member.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Home
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{group.name}</h1>
          <p className="text-xs text-gray-400">Invite link: /invite/{group.invite_code}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Sessions</h2>
            <Link
              href={`/groups/${groupId}/sessions/new`}
              className="text-sm font-medium text-green-600 hover:text-green-700"
            >
              + New session
            </Link>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-gray-400">No sessions yet.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/groups/${groupId}/sessions/${s.id}`}
                    className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-green-500"
                  >
                    <p className="font-medium text-gray-900">
                      {s.status === "proposing" || !s.scheduled_at
                        ? "🗳️ Day poll in progress"
                        : new Date(s.scheduled_at).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                    </p>
                    {s.scheduled_at && s.status !== "proposing" && (
                      <p className="text-xs text-gray-500">
                        {new Date(s.scheduled_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {s.ends_at
                          ? ` – ${new Date(s.ends_at).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}`
                          : ""}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {s.status === "open" ? "Voting open" : s.status} · cap {s.max_capacity}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
