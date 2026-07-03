"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

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

      const confirmation: ConfirmationResult = await signInWithPhoneNumber(
        firebaseAuth,
        phone,
        verifier
      );

      // Store confirmation in sessionStorage so the OTP page can use it
      // (can't pass class instances through navigation state)
      sessionStorage.setItem("otp_phone", phone);
      // @ts-ignore — store the underlying session info string
      sessionStorage.setItem("otp_session", confirmation.verificationId);

      router.push("/verify");
    } catch (err: any) {
      setError(err.message ?? "Failed to send OTP");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">GameDay</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your phone number to sign in
          </p>
        </div>

        <form onSubmit={handleSendOTP} className="space-y-4">
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700"
            >
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              required
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <p className="mt-1 text-xs text-gray-400">Include country code, e.g. +91</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={sending || !phone}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send OTP"}
          </button>
        </form>

        {/* Invisible reCAPTCHA mounts here */}
        <div id="recaptcha-container" />
      </div>
    </main>
  );
}
