"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type User = Database["public"]["Tables"]["users"]["Row"];

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  signOut: () => void;
  setSession: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "gd_access_token";
const USER_KEY = "gd_user";
// The cookie only soft-gates routes in middleware — real auth is the JWT.
// Long max-age so a returning user reaches the app shell and gets silently
// refreshed instead of being bounced to OTP when the old 7-day cookie lapsed.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
// Re-mint the Supabase JWT once it has less than a day left.
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

function tokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const refreshingRef = useRef(false);

  const persistSession = useCallback((token: string, u: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    document.cookie = `gd_session=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    tokenRef.current = token;
    setAccessToken(token);
    setUser(u);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    document.cookie = "gd_session=; path=/; max-age=0";
    tokenRef.current = null;
    setAccessToken(null);
    setUser(null);
  }, []);

  // Silent refresh: Firebase's own session survives browser restarts and
  // auto-refreshes its tokens, so as long as it's alive we can re-run the
  // exchange without OTP. Falls back to signing out only when our JWT is
  // fully expired AND Firebase has nothing to refresh from.
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (refreshingRef.current) return false;
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) return false;
    refreshingRef.current = true;
    try {
      const idToken = await fbUser.getIdToken();
      const res = await fetch("/api/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) return false;
      const { accessToken: newToken, user: freshUser } = await res.json();
      // The exchange answers { needsName } for unknown numbers — can't happen
      // for a user who already had a session, but never persist a gap.
      if (!newToken || !freshUser) return false;
      persistSession(newToken, freshUser);
      return true;
    } catch {
      return false;
    } finally {
      refreshingRef.current = false;
    }
  }, [persistSession]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const stored = localStorage.getItem(USER_KEY);

    if (!token || !stored) {
      setIsLoading(false);
      return;
    }

    let restored: User | null = null;
    try {
      restored = JSON.parse(stored);
    } catch {
      clearSession();
      setIsLoading(false);
      return;
    }

    tokenRef.current = token;
    setAccessToken(token);
    setUser(restored);

    const expMs = tokenExpiryMs(token);
    const needsRefresh = expMs == null || expMs - Date.now() < REFRESH_WINDOW_MS;
    const isExpired = expMs != null && expMs <= Date.now();

    if (!needsRefresh) {
      setIsLoading(false);
      return;
    }

    // Wait for Firebase to restore its persisted session (async on load),
    // then re-exchange. isLoading stays true meanwhile so pages don't
    // redirect or fetch with a dead token.
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      unsubscribe();
      if (fbUser) {
        const ok = await refreshSession();
        if (!ok && isExpired) clearSession();
      } else if (isExpired) {
        clearSession();
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Long-lived tabs (a PWA left open past the refresh window) get an hourly
  // check instead of relying solely on page loads.
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      const expMs = tokenRef.current ? tokenExpiryMs(tokenRef.current) : null;
      if (expMs != null && expMs - Date.now() < REFRESH_WINDOW_MS) {
        refreshSession();
      }
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [accessToken, refreshSession]);

  function setSession(token: string, u: User) {
    persistSession(token, u);
  }

  function signOut() {
    clearSession();
    // Also end the Firebase session — otherwise the silent refresh would
    // quietly log the user straight back in on the next visit.
    firebaseAuth.signOut().catch(() => {});
  }

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, signOut, setSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useSupabase() {
  const { accessToken } = useAuth();
  // Memoized on the token so callers get a stable client reference — without
  // this, a new client is created every render, which breaks any effect that
  // depends on it (re-runs forever instead of once).
  return useMemo(() => createBrowserClient(accessToken ?? undefined), [accessToken]);
}
