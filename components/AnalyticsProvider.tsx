"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { identifyUser, initAnalytics } from "@/lib/analytics";

// Boots PostHog on first load (pageviews) and ties events to the signed-in
// user. Renders nothing; sits inside AuthProvider in the root layout.
export function AnalyticsProvider() {
  const { user } = useAuth();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (user) identifyUser(user.id, user.name);
  }, [user]);

  return null;
}
