"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { friendlyError } from "@/lib/errors";
import { NeoPopButton } from "@/components/NeoPopButton";

export default function LoginPage() {
  const router = useRouter();
  // India-only app: +91 is fixed, the user types just the 10-digit mobile.
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function handlePhoneChange(raw: string) {
    let digits = raw.replace(/\D/g, "");
    // Be forgiving with pastes: "+91 98765 43210" and "098765 43210" both work.
    if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    setPhone(digits.slice(0, 10));
  }

  // Middleware redirects here with ?next=<original path> when a logged-out
  // user clicks a direct link (e.g. a session shared in WhatsApp). Stash it
  // the same way the invite page does, so verify can send them back instead
  // of dropping them on the home page.
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next) sessionStorage.setItem("post_login_redirect", next);
  }, []);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      // Firebase requires a reCAPTCHA verifier. "invisible" handles it silently.
      const verifier = new RecaptchaVerifier(firebaseAuth, "recaptcha-container", {
        size: "invisible",
      });

      const fullPhone = `+91${phone}`;
      const confirmation: ConfirmationResult = await signInWithPhoneNumber(
        firebaseAuth,
        fullPhone,
        verifier
      );

      // Store confirmation in sessionStorage so the OTP page can use it
      // (can't pass class instances through navigation state)
      sessionStorage.setItem("otp_phone", fullPhone);
      // @ts-ignore — store the underlying session info string
      sessionStorage.setItem("otp_session", confirmation.verificationId);

      router.push("/verify");
    } catch (err) {
      setError(friendlyError(err, "Couldn't send the code. Try again in a moment."));
    } finally {
      setSending(false);
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
          <p className="mt-2 text-sm text-chalk-dim">Enter your phone number to sign in</p>
        </div>

        <form onSubmit={handleSendOTP} className="space-y-4">
          <div>
            <label
              htmlFor="phone"
              className="block font-mono text-[11px] uppercase tracking-widest text-chalk-dim"
            >
              Phone number
            </label>
            <div className="mt-1.5 flex items-center rounded-lg border border-line bg-night focus-within:border-floodlight focus-within:shadow-[0_0_16px_rgba(232,255,71,0.15)]">
              <span className="border-r border-line py-3 pl-3 pr-3 font-mono text-base text-chalk-dim">
                +91
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full bg-transparent px-3 py-3 text-base text-chalk placeholder:text-chalk-dim/40 focus:outline-none"
              />
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-chalk-dim">
              10-digit mobile number
            </p>
          </div>

          {error && <p className="text-sm text-card-red">{error}</p>}

          <NeoPopButton
            type="submit"
            className="w-full"
            loading={sending}
            disabled={phone.length !== 10}
          >
            {sending ? "SENDING…" : "SEND OTP"}
          </NeoPopButton>
        </form>

        {/* Invisible reCAPTCHA mounts here */}
        <div id="recaptcha-container" />
      </div>
    </main>
  );
}
