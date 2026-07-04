import { NextRequest, NextResponse } from "next/server";
import { sign } from "jsonwebtoken";
import { adminAuth } from "@/lib/firebase-admin";
import { createServerClient } from "@/lib/supabase/server";

// POST /api/auth/exchange
// Body: { idToken: string, name?: string }
// Returns: { accessToken: string, user: {...} }
export async function POST(req: NextRequest) {
  try {
    // Parse body once — req.json() can only be called once per request
    const body = await req.json();
    const { idToken, name } = body as { idToken?: string; name?: string };

    if (!idToken) {
      return NextResponse.json({ error: "idToken required" }, { status: 400 });
    }

    // 1. Verify Firebase ID token. Phone-OTP tokens carry phone_number;
    // Google Sign-In tokens carry name/picture instead — never both.
    const decoded = await adminAuth.verifyIdToken(idToken);
    const phone = decoded.phone_number ?? null;
    if (!phone && !decoded.email) {
      return NextResponse.json(
        { error: "Token must contain a phone number or an email" },
        { status: 400 }
      );
    }

    // 2. Upsert user in Supabase (secret key — bypass RLS)
    const db = createServerClient();
    const { data: existing } = await db
      .from("users")
      .select("id, name, phone, avatar_url")
      .eq("firebase_uid", decoded.uid)
      .single();

    let userId: string;
    let userRecord: { id: string; name: string; phone: string | null; avatar_url: string | null };

    if (existing) {
      userId = existing.id;
      userRecord = existing;
    } else {
      // Google Sign-In already supplies a name, so only the phone-OTP path
      // (no `decoded.name`) ever needs the client's separate name step —
      // returning users are never asked either way. (This is only reachable
      // after the OTP/Google flow proved identity, so it leaks nothing about
      // which numbers/emails are registered.)
      const resolvedName = name?.trim() || decoded.name;
      if (!resolvedName) {
        return NextResponse.json({ needsName: true });
      }

      const { data: created, error } = await db
        .from("users")
        .insert({
          firebase_uid: decoded.uid,
          name: resolvedName,
          phone,
          avatar_url: decoded.picture ?? null,
        })
        .select("id, name, phone, avatar_url")
        .single();

      if (error || !created) {
        return NextResponse.json(
          { error: "Failed to create user" },
          { status: 500 }
        );
      }
      userId = created.id;
      userRecord = created;
    }

    // 3. Mint a Supabase-compatible JWT signed with the project's JWT secret.
    // 'sub' becomes auth.uid() inside RLS policies.
    const now = Math.floor(Date.now() / 1000);
    const accessToken = sign(
      {
        sub: userId,
        role: "authenticated",
        aud: "authenticated",
        iss: process.env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1",
        iat: now,
        exp: now + 60 * 60 * 24 * 7, // 7 days
      },
      process.env.SUPABASE_JWT_SECRET!,
      { algorithm: "HS256" }
    );

    return NextResponse.json({ accessToken, user: userRecord });
  } catch (err) {
    console.error("[auth/exchange]", err);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }
}
