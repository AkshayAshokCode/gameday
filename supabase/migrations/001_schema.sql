-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Mirrors firebase_uid → internal UUID. Cross-group stats kept here.
create table users (
  id              uuid primary key default gen_random_uuid(),
  firebase_uid    text unique not null,
  name            text not null,
  phone           text unique not null,
  avatar_url      text,
  created_at      timestamptz default now()
);

-- ─── GROUPS ──────────────────────────────────────────────────────────────────
create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text unique not null default encode(gen_random_bytes(6), 'hex'),
  sport       text not null default 'football',
  created_by  uuid references users(id),
  created_at  timestamptz default now()
);

-- ─── GROUP MEMBERS ───────────────────────────────────────────────────────────
create table group_members (
  group_id   uuid references groups(id) on delete cascade,
  user_id    uuid references users(id) on delete cascade,
  role       text not null default 'member', -- 'member' | 'admin'
  joined_at  timestamptz default now(),
  primary key (group_id, user_id)
);

-- ─── TURFS (global — no group_id) ────────────────────────────────────────────
create table turfs (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  address          text,
  lat              double precision,
  lng              double precision,
  default_capacity int,
  photos           text[] default '{}',
  added_by         uuid references users(id),
  created_at       timestamptz default now()
);

-- ─── TURF RATINGS (global) ───────────────────────────────────────────────────
create table turf_ratings (
  id            uuid primary key default gen_random_uuid(),
  turf_id       uuid references turfs(id) on delete cascade,
  session_id    uuid, -- FK added after sessions table exists
  rater_user_id uuid references users(id),
  rating        int check (rating between 1 and 5),
  comment       text,
  created_at    timestamptz default now(),
  unique (turf_id, rater_user_id, session_id)
);

-- ─── SESSIONS ────────────────────────────────────────────────────────────────
create table sessions (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid references groups(id) on delete cascade,
  organizer_id        uuid references users(id),
  payment_collector_id uuid references users(id),
  turf_id             uuid references turfs(id),
  scheduled_at        timestamptz not null,
  max_capacity        int not null default 20,
  team_selection_mode text not null default 'randomize', -- 'randomize' | 'manual' | 'captain_draft'
  status              text not null default 'open', -- 'open' | 'locked' | 'completed'
  created_at          timestamptz default now()
);

-- Add deferred FK from turf_ratings → sessions
alter table turf_ratings
  add constraint turf_ratings_session_id_fkey
  foreign key (session_id) references sessions(id) on delete set null;

-- ─── SESSION VOTES ───────────────────────────────────────────────────────────
create table session_votes (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references sessions(id) on delete cascade,
  user_id       uuid references users(id),
  voted_in      boolean not null default true,
  guest_count   int not null default 0,
  guest_names   text[] default '{}',
  opted_captain boolean not null default false,
  created_at    timestamptz default now(),
  unique (session_id, user_id)
);

-- ─── SESSION WAITLIST ────────────────────────────────────────────────────────
create table session_waitlist (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  user_id    uuid references users(id),
  position   int not null,
  joined_at  timestamptz default now(),
  unique (session_id, user_id)
);

-- ─── ATTENDANCE ──────────────────────────────────────────────────────────────
create table attendance (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  user_id    uuid references users(id),
  attended   boolean not null default false,
  marked_by  uuid references users(id),
  marked_at  timestamptz default now(),
  unique (session_id, user_id)
);

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
create table payments (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid references sessions(id) on delete cascade,
  payer_id            uuid references users(id),
  accountable_member_id uuid references users(id), -- for guests: the member who brought them
  collector_id        uuid references users(id),
  amount              numeric(10, 2),
  status              text not null default 'pending', -- 'pending' | 'paid'
  marked_at           timestamptz,
  created_at          timestamptz default now()
);

-- ─── SESSION CAPTAINS ────────────────────────────────────────────────────────
create table session_captains (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  user_id    uuid references users(id),
  team       text not null, -- 'A' | 'B'
  unique (session_id, user_id)
);

-- ─── MATCH RATINGS ───────────────────────────────────────────────────────────
create table match_ratings (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references sessions(id) on delete cascade,
  rated_user_id  uuid references users(id),
  rater_user_id  uuid references users(id), -- hidden from UI, audit only
  rating_value   int check (rating_value between 1 and 5),
  tags           text[] default '{}',
  created_at     timestamptz default now(),
  unique (session_id, rated_user_id, rater_user_id)
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index on group_members (user_id);
create index on sessions (group_id, scheduled_at desc);
create index on session_votes (session_id);
create index on attendance (session_id);
create index on payments (session_id);
create index on match_ratings (session_id, rated_user_id);
