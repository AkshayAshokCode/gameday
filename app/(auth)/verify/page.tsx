"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  PhoneAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { friendlyError } from "@/lib/errors";
import { NeoPopButton } from "@/components/NeoPopButton";

// Six OTP boxes driven by one invisible input (keeps autofill /
// one-time-code and native keyboards working); the box awaiting input gets
// the floodlight rim, each digit lands with a tick-scale pop.
function OtpBoxes({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, 5);

  return (
    <div className="relative cursor-text" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 w-full opacity-0"
        aria-label="6-digit code"
      />
      <div className="flex justify-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const digit = value[i];
          const isActive = focused && i === activeIndex && value.length < 6;
          return (
            <div
              key={i}
              className={`flex h-14 w-11 items-center justify-center rounded-lg border bg-turf text-2xl font-bold text-chalk transition-shadow ${
                isActive
                  ? "border-floodlight shadow-[0_0_14px_rgba(232,255,71,0.2)]"
                  : "border-line"
              }`}
            >
              <AnimatePresence mode="popLayout">
                {digit && (
                  <motion.span
                    key={`${i}-${digit}`}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {digit}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  // "otp" verifies the code; "name" only appears for brand-new numbers
  // (the exchange answers { needsName } — returning users skip it entirely).
  const [phase, setPhase] = useState<"otp" | "name">("otp");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  // Held after the OTP is consumed — the name step must reuse it, since the
  // same code can't be verified twice.
  const idTokenRef = useRef<string | null>(null);

  // Read from sessionStorage after mount — reading during render makes the
  // server and client disagree and trips a hydration error.
  const [phone, setPhone] = useState("");
  const [verificationId, setVerificationId] = useState("");
  useEffect(() => {
    setPhone(sessionStorage.getItem("otp_phone") ?? "");
    setVerificationId(sessionStorage.getItem("otp_session") ?? "");
  }, []);

  function completeLogin(accessToken: string, user: Parameters<typeof setSession>[1]) {
    setSession(accessToken, user);
    sessionStorage.removeItem("otp_phone");
    sessionStorage.removeItem("otp_session");
    const redirectTo = sessionStorage.getItem("post_login_redirect");
    sessionStorage.removeItem("post_login_redirect");
    router.replace(redirectTo || "/");
  }

  async function exchange(idToken: string, providedName?: string) {
    const res = await fetch("/api/auth/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, name: providedName || undefined }),
    });
    if (!res.ok) {
      const { error: msg } = await res.json();
      throw new Error(msg);
    }
    return res.json();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!verificationId) {
      router.replace("/login");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const result = await signInWithCredential(firebaseAuth, credential);
      const idToken = await result.user.getIdToken();
      idTokenRef.current = idToken;

      const data = await exchange(idToken);
      if (data.needsName) {
        setPhase("name");
      } else {
        completeLogin(data.accessToken, data.user);
      }
    } catch (err) {
      setError(friendlyError(err, "Verification failed. Try again."));
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmitName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    setVerifying(true);
    try {
      const idToken =
        idTokenRef.current ?? (await firebaseAuth.currentUser?.getIdToken()) ?? "";
      const data = await exchange(idToken, name.trim());
      completeLogin(data.accessToken, data.user);
    } catch (err) {
      setError(friendlyError(err, "Couldn't finish signing up. Try again."));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-night px-4">
      <div className="w-full max-w-sm space-y-8">
        {phase === "otp" ? (
          <>
            <div className="text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-chalk-dim">
                Check your phone
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-chalk">Enter OTP</h1>
              <p className="mt-2 text-sm text-chalk-dim">
                Code sent to <span className="font-mono text-chalk">{phone}</span>
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-5">
              <OtpBoxes value={otp} onChange={setOtp} />

              {error && <p className="text-sm text-card-red">{error}</p>}

              <NeoPopButton
                type="submit"
                className="w-full"
                loading={verifying}
                disabled={otp.length < 6}
              >
                {verifying ? "VERIFYING…" : "VERIFY & SIGN IN"}
              </NeoPopButton>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full font-mono text-xs uppercase tracking-wider text-chalk-dim hover:text-chalk"
              >
                ← Use a different number
              </button>
            </form>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-chalk-dim">
                New here 👋
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-chalk">
                What&apos;s your name?
              </h1>
              <p className="mt-2 text-sm text-chalk-dim">
                This is how your group will see you.
              </p>
            </div>

            <form onSubmit={handleSubmitName} className="space-y-5">
              <input
                type="text"
                autoFocus
                placeholder="e.g. Akshay"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-lg border border-line bg-night px-3 py-3 text-base text-chalk placeholder:text-chalk-dim/40 focus:border-floodlight focus:outline-none focus:shadow-[0_0_16px_rgba(232,255,71,0.15)]"
              />

              {error && <p className="text-sm text-card-red">{error}</p>}

              <NeoPopButton
                type="submit"
                className="w-full"
                loading={verifying}
                disabled={!name.trim()}
              >
                {verifying ? "SETTING UP…" : "LET'S PLAY"}
              </NeoPopButton>
            </form>
          </motion.div>
        )}
      </div>
    </main>
  );
}
