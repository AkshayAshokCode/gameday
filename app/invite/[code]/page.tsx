"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface GroupPreview {
  id: string;
  name: string;
  sport: string;
}

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, accessToken, isLoading } = useAuth();
  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${code}`)
      .then(async (res) => {
        if (!res.ok) {
          const { error: msg } = await res.json();
          throw new Error(msg);
        }
        return res.json();
      })
      .then(({ group }) => setGroup(group))
      .catch((err) => setError(err.message ?? "Invite not found"));
  }, [code]);

  function handleLoginRedirect() {
    sessionStorage.setItem("post_login_redirect", `/invite/${code}`);
    router.push("/login");
  }

  async function handleJoin() {
    setError("");
    setJoining(true);
    try {
      const res = await fetch(`/api/invite/${code}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg);
      }

      router.replace("/");
    } catch (err: any) {
      setError(err.message ?? "Failed to join");
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">GameDay</h1>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!error && !group && <p className="text-sm text-gray-500">Loading invite…</p>}

        {group && (
          <>
            <p className="text-gray-700">
              You&apos;ve been invited to join{" "}
              <span className="font-semibold">{group.name}</span>
            </p>

            {isLoading ? null : user ? (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {joining ? "Joining…" : `Join ${group.name}`}
              </button>
            ) : (
              <button
                onClick={handleLoginRedirect}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                Log in to join
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
