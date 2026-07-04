"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useSupabase } from "@/lib/auth-context";
import { CopyInviteLink } from "@/components/CopyInviteLink";
import { NeoPopButton } from "@/components/NeoPopButton";
import { sportEmoji } from "@/lib/sports";
import type { Database } from "@/lib/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];

export default function HomePage() {
  const { user, isLoading, signOut } = useAuth();
  const supabase = useSupabase();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("groups")
      .select("*")
      .then(({ data }) => {
        setGroups(data ?? []);
        setLoadingGroups(false);
      });
  }, [user, supabase]);

  if (isLoading || !user) return null;

  return (
    <main className="min-h-screen bg-night p-6">
      <div className="mx-auto max-w-md space-y-8">
        <div className="flex items-start justify-between pt-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
              Welcome back
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-chalk">
              {user.name}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1 pt-1">
            <Link
              href="/profile"
              className="font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk"
            >
              Profile
            </Link>
            <button
              onClick={signOut}
              className="font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-card-red"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-chalk-dim">
              Your groups
            </h2>
            <Link
              href="/groups/new"
              className="font-mono text-xs uppercase tracking-wider text-floodlight hover:opacity-80"
            >
              + Create
            </Link>
          </div>

          {loadingGroups ? (
            <p className="font-mono text-xs uppercase tracking-wider text-chalk-dim">
              Loading…
            </p>
          ) : groups.length === 0 ? (
            <div className="rounded-xl border border-line bg-turf p-6 text-center space-y-4">
              <p className="font-mono text-xs uppercase tracking-wider text-chalk-dim">
                No groups yet. Start one.
              </p>
              <NeoPopButton onClick={() => router.push("/groups/new")}>
                CREATE A GROUP
              </NeoPopButton>
            </div>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="block rounded-xl border border-line bg-turf p-5 transition-colors hover:border-chalk-dim"
                  >
                    <p className="text-lg font-semibold text-chalk">
                      {sportEmoji(g.sport)} {g.name}
                    </p>
                    <CopyInviteLink code={g.invite_code} className="mt-2" />
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
