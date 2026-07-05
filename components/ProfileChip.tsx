"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

// Persistent top-right avatar on every main page — profile is always one tap
// away. Shows the Google profile photo when we have one, initials otherwise.
export function ProfileChip({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  if (!user) return null;

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Link
      href="/profile"
      aria-label="Your profile"
      title="Your profile"
      className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-turf-raised text-xs font-semibold text-chalk ring-2 ring-line transition-shadow hover:ring-chalk-dim ${className}`}
    >
      {user.avatar_url ? (
        // no-referrer: Google's avatar CDN 403s requests carrying a
        // cross-origin referrer, which silently blanks the image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar_url}
          alt={user.name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </Link>
  );
}
