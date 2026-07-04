# GameDay — Technical Documentation

This is the engineering companion to the [README](README.md). The README tells you *why* GameDay exists; this document tells you *how* it works — architecture, auth, data model, permissions, business logic, and the conventions the codebase follows.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Repository Layout](#2-repository-layout)
3. [Authentication](#3-authentication)
4. [Data Model](#4-data-model)
5. [Session Lifecycle](#5-session-lifecycle)
6. [Roles & Permissions](#6-roles--permissions)
7. [API Routes](#7-api-routes)
8. [Security Model](#8-security-model)
9. [Business Logic Deep-Dives](#9-business-logic-deep-dives)
10. [Design System — "Floodlit"](#10-design-system--floodlit)
11. [Frontend Conventions](#11-frontend-conventions)
12. [Environment Variables](#12-environment-variables)
13. [Database Migrations](#13-database-migrations)
14. [Local Development](#14-local-development)
15. [Deployment](#15-deployment)
16. [Known Limitations & Deferred Features](#16-known-limitations--deferred-features)

---

## 1. Architecture Overview

GameDay is a **client-heavy Next.js app** backed by **Supabase Postgres** for data and **Firebase Auth** for identity, bridged by a small custom JWT exchange.

```
┌─────────────┐   Google popup    ┌──────────────┐
│   Browser    │ ────────────────▶ │ Firebase Auth │
│  (Next.js    │ ◀──── ID token ── │  (identity)   │
│   client)    │                   └──────────────┘
│              │
│              │  POST /api/auth/exchange (ID token)
│              │ ────────────────▶ ┌───────────────────────┐
│              │ ◀─ Supabase JWT ─ │ Next.js API routes     │
│              │                   │ (Vercel serverless)    │
│              │                   │ · verify via admin SDK │
│              │                   │ · mint HS256 JWT       │
│              │                   │ · privileged writes    │
│              │                   └───────────┬───────────┘
│              │                               │ secret key (bypasses RLS)
│              │   direct reads/writes         ▼
│              │ ────────────────▶ ┌───────────────────────┐
│              │   (JWT + RLS)     │  Supabase Postgres     │
└─────────────┘                   │  (Row Level Security)  │
                                  └───────────────────────┘
```

Two write paths, deliberately:

- **Client → Supabase directly** for anything a member is allowed to do on their own behalf (voting in a day poll, editing a session as organizer, saving a turf). RLS policies are the gatekeeper.
- **Client → Next.js API route → Supabase (secret key)** for anything that must be coordinated or must not be client-authored: vote-with-waitlist logic, team formation, session completion + payment generation, group creation (self-assigning `admin`), invite joins. For these tables, RLS intentionally has **no client insert policy** — the API route is the only path.

There is no realtime layer; pages refetch after each mutation (`loadData()` pattern).

---

## 2. Repository Layout

```
app/
  (auth)/login/          Google Sign-In page (only entry point)
  (auth)/verify/         Disabled stub — redirects to /login (was phone OTP)
  api/
    auth/exchange/       Firebase ID token → Supabase-compatible JWT
    groups/              Create group (server-side: assigns creator as admin)
    invite/[code]/       Public group preview + authenticated join
    sessions/[id]/
      vote/              Vote in/out with capacity + waitlist handling
      complete/          Finalize session, generate payment rows
      teams/randomize/   Shuffle confirmed players (+ guests) into 2 teams
  groups/
    new/                 Create-group form
    [groupId]/           Group home: hero session card, past sessions
      leaderboard/       Disabled — redirects to group page
      sessions/new/      Create session (single day or day poll)
      sessions/[id]/     Session detail: voting, edit, attendance, teams, payments
      turfs/             Group's saved turfs (add/remove, map picker)
  invite/[code]/         Public invite landing page
  profile/               Games count, UPI ID, per-group stats
components/              Shared UI (NeoPopButton, NumberStepper, TurfSelect,
                         TimeRangeSelect, ceremonies, etc.)
lib/
  auth-context.tsx       Session provider: token storage, silent refresh, signOut
  auth-server.ts         getUserId() — verifies Bearer JWT in API routes
  errors.ts              friendlyError() — humanizes SDK/DB errors
  firebase.ts            Client SDK init
  firebase-admin.ts      Admin SDK init (server only)
  sports.ts              Sport registry (id, label, emoji)
  supabase/              Client factory, server (secret key) factory, DB types
  upi.ts                 UPI deep link + QR generation
middleware.ts            Cookie-based route gating (see §3)
supabase/migrations/     001–010, run in order in the Supabase SQL editor
```

---

## 3. Authentication

### Sign-in flow (Google-only)

1. User taps **Continue with Google** → `signInWithPopup` (Firebase client SDK).
2. Client gets a **Firebase ID token** and POSTs it to `/api/auth/exchange`.
3. The route verifies the token with the **Firebase Admin SDK**, then upserts the user in Supabase (matched on `firebase_uid`). New users are created immediately using Google's `name` and `picture` — no extra signup step.
4. The route mints a **Supabase-compatible JWT** — HS256, signed with the project's `SUPABASE_JWT_SECRET`, with `sub` = the user's UUID, `role: authenticated`, 7-day expiry. Inside RLS policies, `auth.uid()` resolves to this `sub`.
5. Client stores `gd_access_token` + `gd_user` in `localStorage` and sets a `gd_session` cookie (value `1`, 180-day max-age).

### Why the bridge exists

Supabase's built-in auth doesn't do Google-via-Firebase, and Firebase tokens aren't Supabase JWTs. Minting our own token keeps Supabase RLS fully functional (`auth.uid()` works) while Firebase remains the identity provider.

### Session persistence & silent refresh

The 7-day Supabase JWT would log people out weekly, which kills a habit app. `lib/auth-context.tsx` fixes this:

- On mount, it decodes the stored JWT's expiry. If it's near/past expiry, it waits for Firebase's own persisted session (`onAuthStateChanged`) — which survives browser restarts and auto-refreshes — grabs a fresh ID token, and silently re-runs the exchange. No user interaction.
- An hourly interval re-checks while the tab stays open.
- `signOut()` clears local storage, the cookie, **and** the Firebase session.

Net effect: users stay signed in for ~180 days of normal use with zero re-auth prompts.

### Route gating (`middleware.ts`)

The JWT lives in `localStorage`, which the server can't read — so the middleware uses the lightweight `gd_session` cookie purely as a "probably logged in" signal. Logged-out requests to non-public paths are redirected to `/login?next=<original-path>`; the login page stashes `next` and restores it after sign-in (so a session link shared in WhatsApp lands you on that session, not the home page).

Public paths: `/login`, `/verify`, `/invite`, `/api/invite` (the invite *preview* must work logged-out), `/api/auth`.

> The cookie is a UX gate, not a security boundary. Actual security is the JWT verification in API routes plus RLS in Postgres.

---

## 4. Data Model

All tables live in Supabase Postgres with RLS enabled. Child rows cascade on delete of their parent (deleting a group deletes its sessions, which delete their votes/attendance/payments/teams).

### `users`
| Column | Notes |
|---|---|
| `id` uuid PK | Referenced by everything; `sub` in the JWT |
| `firebase_uid` | Unique; the identity bridge key |
| `name` | From Google profile |
| `phone` | Nullable (legacy from phone-OTP era; Google accounts have none) |
| `avatar_url` | Google profile picture |
| `upi_id` | Set on profile; enables UPI deep link/QR when collecting |

### `groups`
`name`, `sport` (default `football`), `created_by`, and a unique `invite_code` (12 hex chars, auto-generated). The invite code **is** the invite — anyone possessing the link can join (accepted v1 trade-off; no rotation yet).

### `group_members`
Composite PK `(group_id, user_id)` + `role` (`member` | `admin`). Self-service joins are RLS-constrained to `role = 'member'` — admin rows are only created server-side.

### `turfs` (global) + `group_turfs` (junction)
Turfs are a **global directory** (name, `lat`/`lng` map pin, optional legacy `address`), not owned by groups — the same turf can serve many groups. `group_turfs` records which turfs a group has explicitly saved. A group's "own turfs" tier in pickers = *turfs used in its past sessions* ∪ *explicitly saved*, most recent first.

### `sessions`
The core entity. Key columns:

| Column | Notes |
|---|---|
| `status` | `proposing` → `open` → `locked` → `completed` (see §5) |
| `organizer_id` | Creator; co-equal with group admins for management |
| `payment_collector_id` | Nullable; defaults to organizer when null |
| `turf_id`, `scheduled_at`, `ends_at` | All editable post-creation |
| `max_capacity` | Confirmed headcount ceiling (guests count); editable |
| `cost_per_head` | Set before completion; drives payment amounts |
| `sport` | Null = inherit group's sport |
| `team_selection_mode` | `randomize` (only implemented mode) |

### Day polls: `session_day_options` + `session_day_votes`
A `proposing` session has 2+ candidate days (each carrying the shared time slot). Members toggle a vote per day they can make. The organizer locks in a winner → its times are copied onto the session and status flips to `open`.

### `session_votes`
One row per member per session: `voted_in` boolean, `guest_count`, `guest_names[]` (names are mandatory — enforced client-side). `opted_captain` exists in the schema but is unused (deferred captain-draft feature).

### `session_waitlist`
FIFO positions. Managed exclusively by the vote API route — no client write policies.

### `attendance`
`(session_id, user_id, attended, marked_by)`. Marked by organizer/admin once the session is locked. Drives streaks and payment generation. **Not** used for team formation (see §9).

### `payments`
Generated once at completion: one row per attended member — `payer_id`, `collector_id`, `amount` (= `cost_per_head × (1 + guest_count)`, or null if no cost set), `status` (`pending`/`paid`), `marked_at`.

### `session_captains` (team assignments)
One row per slot on a team (`team` = `A`/`B`). Either a member slot (`user_id` set) **or** a guest slot (`guest_name` + `invited_by` set) — enforced by a check constraint. Because `invited_by` is a second FK to `users`, PostgREST embeds must name the constraint explicitly: `users!session_captains_user_id_fkey(name)`.

### Vestigial (schema exists, unused in v1)
`turf_ratings`, `match_ratings`.

---

## 5. Session Lifecycle

```
                    finalize day
  ┌────────────┐   (organizer)    ┌────────┐
  │ proposing  │ ───────────────▶ │  open   │ ◀──────────┐
  │ (day poll) │                  │ (voting)│            │ reopen poll
  └────────────┘                  └────┬────┘            │ (only while no
        ▲                              │ close poll      │  teams formed)
        │ created with                 ▼                 │
        │ "let the group vote"    ┌────────┐ ────────────┘
                                  │ locked  │
  created with a single day ────▶ │(squads) │
  starts directly at "open"       └────┬────┘
                                       │ mark complete
                                       ▼   (generates payments)
                                  ┌───────────┐
                                  │ completed  │  (terminal)
                                  └───────────┘
```

**What's available at each stage** (for organizer/admin):

| Stage | Actions |
|---|---|
| `proposing` | Edit turf/capacity · finalize the winning day |
| `open` | Edit date/time/turf/capacity · close poll |
| `locked` | Edit date/time/turf/capacity · set cost per head · reassign collector · mark attendance · form/re-randomize teams · reopen poll (if no teams yet) · mark complete |
| `completed` | Re-randomize teams · mark payments (as collector) |

Members can vote in/out (with guests) only while `open`; day-poll voting only while `proposing`.

---

## 6. Roles & Permissions

There are no user account "types" — capability is contextual:

| Capability | Member | Session organizer | Group admin |
|---|:-:|:-:|:-:|
| Vote in/out, add guests | ✅ | ✅ | ✅ |
| Vote in day polls | ✅ | ✅ | ✅ |
| Create sessions | ✅ | — | — |
| Save/remove group turfs | ✅ | ✅ | ✅ |
| Edit session (time/turf/capacity) | ❌ | ✅ | ✅ |
| Close / reopen poll, finalize day | ❌ | ✅ | ✅ |
| Mark attendance | ❌ | ✅ | ✅ |
| Form / re-randomize teams | ❌ | ✅ | ✅ |
| Set cost, reassign collector, complete session | ❌ | ✅ | ✅ |
| Delete session (hold-to-confirm, any status) | ❌ | ✅ | ✅ |
| Mark **own** payment paid | ✅ (hold-to-confirm) | ✅ | ✅ |
| Mark **others'** payments paid | ❌ | only if collector | only if collector |
| Remove members from group | ❌ | ❌ | ✅ |

`canManage = (session.organizer_id === user.id) || groupRole === 'admin'` — checked in the UI (buttons hidden) **and** re-checked server-side / in RLS (requests rejected).

The **collector** (`payment_collector_id ?? organizer_id`) is a per-session responsibility any member can be assigned; it only governs marking payments.

---

## 7. API Routes

All routes expect `Authorization: Bearer <gameday JWT>` unless noted. They verify the JWT themselves (`lib/auth-server.ts`) and use the Supabase **secret key** client, so they must re-check membership/roles explicitly (RLS doesn't apply).

| Route | Purpose |
|---|---|
| `POST /api/auth/exchange` | Body `{ idToken, name? }`. Verifies Firebase token, upserts user, returns `{ accessToken, user }`. Accepts Google (email) or phone tokens. Returns `{ needsName: true }` only if the token has no name (phone-era path). |
| `POST /api/groups` | Body `{ name, sport? }`. Creates group + inserts creator as `admin` (clients can't self-assign admin — RLS). |
| `GET /api/invite/[code]` | **Public.** Group name/preview for the invite landing page. |
| `POST /api/invite/[code]/join` | Joins requester as `member`. Idempotent. |
| `POST /api/sessions/[id]/vote` | Body `{ voted_in, guest_count?, guest_names? }`. Full capacity/waitlist logic (see §9). Only while `open`. |
| `POST /api/sessions/[id]/teams/randomize` | Organizer/admin. Shuffles confirmed voters + their guests into teams A/B. Requires `locked`/`completed` and ≥2 slots. |
| `POST /api/sessions/[id]/complete` | Organizer/admin. Requires `locked`. Generates payment rows (once), flips to `completed`. |

---

## 8. Security Model

**Layered:** middleware cookie gate (UX only) → JWT verification (API routes) → RLS (Postgres, the real boundary).

RLS philosophy, per table:

- **Reads:** scoped to group membership via the `is_group_member(group_id)` SQL helper. Turfs are globally readable.
- **Client writes allowed:** own votes/day-votes (insert/update/delete own rows), sessions update **and delete** (organizer/admin policies), group_turfs (members), attendance upsert (via policy), own-payment status update, collector-payment update, self-join as `member`.
- **Client writes deliberately absent:** `session_waitlist`, `session_captains`, `payments` inserts, `group_members` as admin — all server-route-only, because they encode invariants (FIFO waitlist, one-payment-per-attendee, admin assignment) that a client shouldn't be able to author.

Notable hardening (migration 003): the original self-join policy didn't constrain `role`, letting anyone insert themselves as `admin` into any group. Fixed to force `role = 'member'` on self-service joins.

Secrets: `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, and Firebase Admin credentials are server-only (no `NEXT_PUBLIC_` prefix, never bundled client-side). `.env*` is gitignored (except the placeholder `.env.local.example`).

---

## 9. Business Logic Deep-Dives

### Voting & waitlist (`/api/sessions/[id]/vote`)

- A party = the member + their named guests; `partySize = 1 + guest_count`.
- Vote **in**: compute the current confirmed headcount (voted-in, non-waitlisted, including their guests). If `headcount + partySize ≤ max_capacity` → confirmed; else → appended to the waitlist (position = max + 1).
- Vote **out**: vote row flips to out; if the member *was* confirmed, the earliest-position waitlisted member is promoted (simple FIFO — no bin-packing of party sizes against freed capacity, by design).
- Guest names are mandatory; the client blocks submission until every guest slot has a name.

### Team formation (`/api/sessions/[id]/teams/randomize`)

- Pool = **confirmed voters** (voted in, not waitlisted) + one independent slot per named guest. *Not* attendance-based — squads are usually decided before anyone reaches the turf, whereas attendance can only be marked after people show up.
- Fisher–Yates shuffle, split down the middle. Guests are attributed to their inviter (`invited_by`) but shuffled independently, so one member's +2 can't unbalance the teams.
- Previous assignments are cleared first; re-randomizing is always available to organizer/admin.
- Client-side, the Squad Reveal ceremony plays (~3.5s: shuffle → deal → stamp), tap-to-skip.

### Payments (`/api/sessions/[id]/complete`)

- Generated **once** (guarded by an existing-rows check, so re-completing can't duplicate).
- One row per **attended** member: `amount = cost_per_head × (1 + guest_count)`; null amounts if no cost was set (UI then counts rows instead of rupees).
- Payers self-mark via **hold-to-confirm** (600 ms press); the collector can mark anyone. Members with the collector's `upi_id` on file see a UPI deep link + QR for their exact amount.
- Settling the last payment triggers a small confetti tick on the collection bar.

### Streaks

Computed client-side from attendance: sort a member's attendance rows chronologically, count backward from the most recent until the first `attended = false`. A current-run streak, not a lifetime best. Milestones at multiples of 5 get a full-screen takeover (deduped via localStorage).

---

## 10. Design System — "Floodlit"

*A turf at night under floodlights: everything dark except what matters.*

**Tokens** (CSS custom properties in `app/globals.css`, exposed as Tailwind utilities via `@theme inline`):

| Token | Value | Use |
|---|---|---|
| `--night` | `#0a0e0b` | App background (near-black, green undertone) |
| `--turf` | `#121a14` | Cards / surfaces |
| `--turf-raised` | `#1a241c` | Elevated surfaces, pressed states |
| `--floodlight` | `#e8ff47` | **The** accent — earned, not decorative; one per screen max |
| `--chalk` / `--chalk-dim` | `#f2f5ef` / `#7e8b80` | Primary / secondary text |
| `--card-red` | `#ff4d4d` | Destructive & "out" states only |
| `--line` | 7% white | Hairline borders |

**Typography:** Space Grotesk (display/body) + JetBrains Mono (labels, timestamps, eyebrows) via `next/font`.

**NeoPOP buttons:** solid offset shadow beneath-right; on press the button translates *into* the shadow (90 ms), physically depressing. `loading` state keeps full brightness and spins the sport's emoji.

**Ceremonies** (all respect `prefers-reduced-motion`):
1. **Vote-In** — radial sweep + particle burst from the tap point
2. **Squad Reveal** — shuffle → deal → stamp, tap-to-skip, never auto-dismisses (it's the screenshot moment)
3. **Streak Milestone** — full-screen takeover at multiples of 5
4. **Payment Settled** — strike-through + liquid collection bar + all-settled tick
5. **Invite/Join** — panning turf texture + avatar rail + welcome stamp

**Motion rules:** standard easing `cubic-bezier(0.22,1,0.36,1)`; celebration overshoot reserved for ceremonies; numbers never jump — they count (`CountUp`). Page-to-page navigation uses the **View Transitions API** (Next.js experimental flag) with a shared `view-transition-name` morphing the group page's hero card into the session header.

`color-scheme: dark` is set globally — without it, native form controls (date pickers, selects) render black-on-black in Safari.

---

## 11. Frontend Conventions

Patterns the codebase follows consistently — follow them in new code:

- **Auth-loading guard (every page):**
  ```tsx
  useEffect(() => { if (!isLoading && !user) router.replace("/login"); }, [...]);
  useEffect(() => { if (!user) return; loadData(); }, [user, ...]);
  if (isLoading || !user || loading) return null;
  ```
  Skipping the `!user` guard makes the first effect run with an unauthenticated Supabase client → RLS-blocked requests → console 406s that "self-heal" confusingly.

- **Numeric inputs are raw strings**, coerced only on submit/blur. Coercing to `Number` on every keystroke forces `"0"` back in and blocks clearing the field. See `NumberStepper` / `maxCapacityInput`.

- **`friendlyError(err, fallback)`** wraps every catch block that surfaces to users. Three tiers: known Firebase codes → hand-written messages; our own API messages → passed through; anything technical-looking → the fallback. Never show raw SDK/Postgres text.

- **Error displays must exist near every action that can fail.** The shared `error` state is only useful if a `{error && ...}` render exists in the section where the failing button lives (a past bug: team-formation errors rendered nowhere).

- **Touch targets:** interactive text elements get real padding (`py-2.5`+), not just visual gaps; icon buttons get ≥ 44 px hit areas (negative margins to avoid layout shift). Mobile-first — the group chat lives on phones.

- **Leaflet is SSR-incompatible** — always `next/dynamic` with `ssr: false` (`TurfLocationPicker`).

- **Tiered turf pickers** use the shared `TurfSelect` ("This group's turfs" first, then the global directory).

---

## 12. Environment Variables

See `.env.local.example` for the full annotated template.

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client | Anon-role key (RLS applies) |
| `SUPABASE_SECRET_KEY` | server | Service-role key — bypasses RLS; API routes only |
| `SUPABASE_JWT_SECRET` | server | Signs the minted auth JWTs (must match Supabase's legacy JWT secret) |
| `NEXT_PUBLIC_FIREBASE_*` (4) | client | Firebase web app config |
| `FIREBASE_ADMIN_*` (3) | server | Admin SDK service account (private key kept as one line with literal `\n`) |

---

## 13. Database Migrations

Run in order in the Supabase SQL editor (no CLI pipeline in v1):

| # | What it does |
|---|---|
| 001 | Core schema: users, groups, members, turfs, sessions, votes, waitlist, attendance, payments, captains, ratings |
| 002 | RLS policies + `is_group_member()` helper |
| 003 | **Security fix:** self-joins can no longer self-assign `admin` |
| 004 | Day polls: `session_day_options` / `session_day_votes` |
| 005 | Time ranges: `ends_at` on sessions and day options |
| 006 | Payments support: `cost_per_head`, `upi_id`, collector update policy |
| 007 | Per-session `sport` (null = inherit group's) |
| 008 | `group_turfs` junction (a group's saved turfs) |
| 009 | Guest team slots: `guest_name` + `invited_by` on `session_captains` |
| 010 | `users.phone` nullable (Google Sign-In has no phone) |
| 011 | Session delete policy (organizer/admin; children cascade) |

---

## 14. Local Development

```bash
pnpm install                        # Node 22+ required
cp .env.local.example .env.local    # fill in real values
pnpm dev                            # http://localhost:3000
```

Prerequisites beyond env vars:
- All migrations applied to your Supabase project
- **Google** enabled as a sign-in provider in Firebase (Authentication → Sign-in method), with a support email set
- `localhost` present in Firebase's authorized domains (it is by default)

Type checking: `pnpm exec tsc --noEmit`. There is no test suite in v1; verification has been done via live Playwright runs against a real Supabase project.

---

## 15. Deployment

Hosted on **Vercel**, auto-deploying from `main` on the connected GitHub repo. Live at `itsgameday.vercel.app`.

Checklist for a new environment:
1. Import the repo into Vercel (Next.js preset auto-detected).
2. Add all env vars from §12 (Production + Preview).
3. Add the deployed domain to **Firebase → Authentication → Authorized domains** — Google Sign-In silently fails without this.
4. Apply any new migrations to Supabase **before** deploying code that depends on them.

Build gotchas already handled in the repo:
- `firebase-admin` → `jwks-rsa@4` → `jose@6` is ESM-only and breaks the Turbopack build. Fixed via a pnpm override pinning `jwks-rsa: 3.2.2` (in `pnpm-workspace.yaml` — pnpm ≥ 10 ignores overrides in `package.json`) plus `serverExternalPackages: ["firebase-admin"]` in `next.config.ts`.
- `pnpm-workspace.yaml` must have a `packages:` field or pnpm refuses to run.

---

## 16. Known Limitations & Deferred Features

Deliberate v1 trade-offs, documented so they're not mistaken for bugs:

- **Leaderboard is disabled** — the page redirects to the group; the code is intact. Re-enable by removing the redirect effect and restoring the group-page link.
- **Phone-OTP sign-in is hidden**, not removed — the exchange route still accepts phone tokens, and `/verify` is a redirect stub. Restoring it is a login-page change (plus Firebase Blaze billing for SMS).
- **Captain draft** — schema hooks exist (`opted_captain`, `team_selection_mode`) but only random teams are implemented.
- **Invite links don't rotate** — possession = entry. Fine for trusted friend groups; "regenerate invite" is a small future feature.
- **No self-leave / no group-deletion UI** — admins can remove members and delete sessions (hold-to-confirm on the session page), but groups persist forever and members can't leave on their own (both require direct DB access).
- **Re-randomize isn't attendance-aware** — it reshuffles the same confirmed pool even after attendance is marked, so a no-show can appear on a roster.
- **No realtime** — headcounts update on refetch, not via subscriptions.
- **Avatars** — Google profile photos are stored but member lists still render initials.
