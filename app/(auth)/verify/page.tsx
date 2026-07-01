"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PhoneAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

export default function VerifyPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const phone = typeof window !== "undefined"
    ? sessionStorage.getItem("otp_phone") ?? ""
    : "";
  const verificationId = typeof window !== "undefined"
    ? sessionStorage.getItem("otp_session") ?? ""
    : "";

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!verificationId) {
      router.replace("/login");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      // Verify OTP with Firebase
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const result = await signInWithCredential(firebaseAuth, credential);
      const idToken = await result.user.getIdToken();

      // Exchange Firebase token for Supabase JWT
      const res = await fetch("/api/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, name: name || undefined }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg);
      }

      const { accessToken, user } = await res.json();
      setSession(accessToken, user);

      sessionStorage.removeItem("otp_phone");
      sessionStorage.removeItem("otp_session");

      router.replace("/");
    } catch (err: any) {
      setError(err.message ?? "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Enter OTP</h1>
          <p className="mt-1 text-sm text-gray-500">
            Code sent to <span className="font-medium">{phone}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label
              htmlFor="otp"
              className="block text-sm font-medium text-gray-700"
            >
              6-digit code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-xl tracking-[0.5em] text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* Only shown for new users */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Your name <span className="text-gray-400">(new users only)</span>
            </label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Akshay"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={verifying || otp.length < 6}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {verifying ? "Verifying…" : "Verify & sign in"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            ← Use a different number
          </button>
        </form>
      </div>
    </main>
  );
}
