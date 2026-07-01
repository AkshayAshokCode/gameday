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

    // 1. Verify Firebase ID token
    const decoded = await adminAuth.verifyIdToken(idToken);
    const phone = decoded.phone_number;
    if (!phone) {
      return NextResponse.json(
        { error: "Token must contain a phone number" },
        { status: 400 }
      );
    }

    // 2. Upsert user in Supabase (service role — bypass RLS)
    const db = createServerClient();
    const { data: existing } = await db
      .from("users")
      .select("id, name, phone, avatar_url")
      .eq("firebase_uid", decoded.uid)
      .single();

    let userId: string;
    let userRecord: { id: string; name: string; phone: string; avatar_url: string | null };

    if (existing) {
      userId = existing.id;
      userRecord = existing;
    } else {
      const { data: created, error } = await db
        .from("users")
        .insert({
          firebase_uid: decoded.uid,
          name: name ?? phone,
          phone,
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
