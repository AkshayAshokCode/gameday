"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Phone sign-in is hidden (login is Google-only now) — nothing links here
// anymore, and there's no way to reach a valid OTP session without the
// phone flow that used to populate it. Kick anyone who lands here (bookmark,
// back button) straight back to /login.
export default function VerifyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
