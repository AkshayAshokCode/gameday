"use client";

import posthog from "posthog-js";

// Thin PostHog wrapper. Every function no-ops unless NEXT_PUBLIC_POSTHOG_KEY
// is set, so the integration is safe to ship before the account exists and
// analytics can be turned off by just removing the env var.
//
// Event names are past-tense snake_case ("session_created"). Keep payloads
// small and PII-free — the user is identified once by id/name via identify(),
// everything else rides on that.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

function ensureInit(): boolean {
  if (initialized) return true;
  if (!KEY || typeof window === "undefined") return false;
  posthog.init(KEY, {
    api_host: HOST,
    // SPA route changes count as pageviews (App Router never full-reloads).
    capture_pageview: "history_change",
    // Only the events we name explicitly — autocapture is noise at our scale.
    autocapture: false,
    persistence: "localStorage",
  });
  if (process.env.NODE_ENV !== "production") {
    // Dev-only handle so integration tests can observe capture() calls
    // without a real PostHog project.
    (window as unknown as Record<string, unknown>).__posthog = posthog;
  }
  initialized = true;
  return true;
}

/** Fire on app load so pageviews start flowing before any explicit event. */
export function initAnalytics() {
  ensureInit();
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!ensureInit()) return;
  posthog.capture(event, properties);
}

/** Tie events to the signed-in user (survives across devices/sessions). */
export function identifyUser(id: string, name: string) {
  if (!ensureInit()) return;
  posthog.identify(id, { name });
}

/** On sign-out — so a shared device doesn't attribute the next person's events. */
export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
}
