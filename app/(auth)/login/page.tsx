"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { friendlyError } from "@/lib/errors";
import { NeoPopButton } from "@/components/NeoPopButton";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // Middleware redirects here with ?next=<original path> when a logged-out
  // user clicks a direct link (e.g. a session shared in WhatsApp). Stash it
  // the same way the invite page does, so we can send them back instead of
  // dropping them on the home page.
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next) sessionStorage.setItem("post_login_redirect", next);
  }, []);

  // Google proves identity in one step — no separate OTP/name screen needed.
  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, name: result.user.displayName || undefined }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg);
      }
      const data = await res.json();
      setSession(data.accessToken, data.user);

      const redirectTo = sessionStorage.getItem("post_login_redirect");
      sessionStorage.removeItem("post_login_redirect");
      router.replace(redirectTo || "/");
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      // The user closing the popup themselves isn't a real error — showing
      // red text for "you changed your mind" is bad UX, so stay silent.
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(friendlyError(err, "Couldn't sign in with Google. Try again."));
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-night px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-chalk-dim">
            Under the floodlights
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tighter text-chalk">GameDay</h1>
          <p className="mt-2 text-sm text-chalk-dim">Sign in to continue</p>
        </div>

        <div className="space-y-4">
          <NeoPopButton
            type="button"
            className="w-full"
            onClick={handleGoogleSignIn}
            loading={googleLoading}
          >
            {googleLoading ? "SIGNING IN…" : "CONTINUE WITH GOOGLE"}
          </NeoPopButton>

          {error && <p className="text-sm text-card-red">{error}</p>}
        </div>
      </div>
    </main>
  );
}
