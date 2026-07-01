"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function NewGroupPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg);
      }

      router.replace("/");
    } catch (err: any) {
      setError(err.message ?? "Failed to create group");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Create a group</h1>
          <p className="mt-1 text-sm text-gray-500">
            You&apos;ll be the admin — invite others with a link after.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Group name
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="e.g. Sunday Footy Crew"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create group"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            ← Cancel
          </button>
        </form>
      </div>
    </main>
  );
}
