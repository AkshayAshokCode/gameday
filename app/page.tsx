"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-900">GameDay</h1>
      <p className="text-gray-600">Welcome, {user.name}</p>
      <p className="text-sm text-gray-400">Groups &amp; sessions coming next.</p>
      <button
        onClick={signOut}
        className="mt-4 text-sm text-red-500 hover:text-red-700"
      >
        Sign out
      </button>
    </main>
  );
}
