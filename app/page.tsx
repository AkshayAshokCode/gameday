"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useSupabase } from "@/lib/auth-context";
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
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GameDay</h1>
            <p className="text-sm text-gray-500">Welcome, {user.name}</p>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Sign out
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Your groups</h2>
            <Link
              href="/groups/new"
              className="text-sm font-medium text-green-600 hover:text-green-700"
            >
              + Create group
            </Link>
          </div>

          {loadingGroups ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-gray-400">You&apos;re not in any groups yet.</p>
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-green-500"
                  >
                    <p className="font-medium text-gray-900">{g.name}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Invite link: /invite/{g.invite_code}
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
