"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useAuth, useSupabase } from "@/lib/auth-context";
import { friendlyError } from "@/lib/errors";
import { NeoPopButton } from "@/components/NeoPopButton";

// First-ever sign-in lands here: Google already gave us a name, but "Akshay
// Ashokan" on a Google account and "Akshay" to your football group are
// different things — confirm or adjust it before entering. Pre-filled, so
// the happy path is a single tap.
export default function WelcomePage() {
  const router = useRouter();
  const { user, accessToken, isLoading, setSession } = useAuth();
  const supabase = useSupabase();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  // Pre-fill once the session user is available.
  useEffect(() => {
    if (user) setName((prev) => prev || user.name);
  }, [user]);

  function finish() {
    const redirectTo = sessionStorage.getItem("post_login_redirect");
    sessionStorage.removeItem("post_login_redirect");
    router.replace(redirectTo || "/");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !user) return;
    if (trimmed === user.name) {
      finish();
      return;
    }
    setError("");
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({ name: trimmed })
        .eq("id", user.id);
      if (updateError) throw new Error(updateError.message);
      // Refresh the locally-stored session user so every page greets the
      // new name immediately.
      setSession(accessToken!, { ...user, name: trimmed });
      finish();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save your name. Try again."));
      setSaving(false);
    }
  }

  if (isLoading || !user) return null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-night px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-chalk-dim">
            New here 👋
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-chalk">
            What should your group call you?
          </h1>
          <p className="mt-2 text-sm text-chalk-dim">
            This is how you&apos;ll show up on rosters and squads.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="text"
            autoFocus
            placeholder="e.g. Akshay"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full rounded-lg border border-line bg-night px-3 py-3 text-base text-chalk placeholder:text-chalk-dim/40 focus:border-floodlight focus:outline-none focus:shadow-[0_0_16px_rgba(232,255,71,0.15)]"
          />

          {error && <p className="text-sm text-card-red">{error}</p>}

          <NeoPopButton type="submit" className="w-full" loading={saving} disabled={!name.trim()}>
            {saving ? "SETTING UP…" : "LET'S PLAY"}
          </NeoPopButton>
        </form>
      </motion.div>
    </main>
  );
}
