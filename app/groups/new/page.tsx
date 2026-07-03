"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NeoPopButton } from "@/components/NeoPopButton";

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
    <main className="min-h-screen flex items-center justify-center bg-night px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-chalk">Create a group</h1>
          <p className="mt-1 text-sm text-chalk-dim">
            You&apos;ll be the admin — invite others with a link after.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block font-mono text-[11px] uppercase tracking-widest text-chalk-dim"
            >
              Group name
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="e.g. Sunday Footy Crew"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-card-red">{error}</p>}

          <NeoPopButton type="submit" className="w-full" disabled={creating || !name.trim()}>
            {creating ? "CREATING…" : "CREATE GROUP"}
          </NeoPopButton>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk"
          >
            ← Cancel
          </button>
        </form>
      </div>
    </main>
  );
}
