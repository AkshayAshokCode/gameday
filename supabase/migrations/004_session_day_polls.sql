-- Multi-day polling: a session can start in 'proposing' status with candidate
-- day options instead of a fixed date. Members vote per-day (multi-select —
-- "which of these work for you"), then the organizer/admin finalizes by
-- picking a winner, which sets scheduled_at and flips status to 'open'.
-- status values now: 'proposing' | 'open' | 'locked' | 'completed'.
-- No capacity/waitlist logic applies during 'proposing' — that only makes
-- sense once a concrete day is locked in.
alter table sessions alter column scheduled_at drop not null;

create table session_day_options (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references sessions(id) on delete cascade,
  scheduled_at timestamptz not null,
  created_at   timestamptz default now(),
  unique (session_id, scheduled_at)
);

create table session_day_votes (
  day_option_id uuid references session_day_options(id) on delete cascade,
  user_id       uuid references users(id) on delete cascade,
  created_at    timestamptz default now(),
  primary key (day_option_id, user_id)
);

create index on session_day_options (session_id);
create index on session_day_votes (day_option_id);

-- ─── SESSION DAY OPTIONS ─────────────────────────────────────────────────────
alter table session_day_options enable row level security;

create policy "session_day_options: members can read"
  on session_day_options for select using (
    exists (select 1 from sessions s where s.id = session_id and is_group_member(s.group_id))
  );

-- Any group member can propose day options, mirroring "sessions: members can
-- create" — organizing isn't admin-gated in this app.
create policy "session_day_options: members can propose"
  on session_day_options for insert with check (
    exists (select 1 from sessions s where s.id = session_id and is_group_member(s.group_id))
  );

-- ─── SESSION DAY VOTES ───────────────────────────────────────────────────────
alter table session_day_votes enable row level security;

create policy "session_day_votes: members can read"
  on session_day_votes for select using (
    exists (
      select 1 from session_day_options o
      join sessions s on s.id = o.session_id
      where o.id = day_option_id and is_group_member(s.group_id)
    )
  );

create policy "session_day_votes: members can vote own"
  on session_day_votes for insert with check (
    user_id = (select u.id from users u where u.id::text = auth.uid()::text)
    and exists (
      select 1 from session_day_options o
      join sessions s on s.id = o.session_id
      where o.id = day_option_id and is_group_member(s.group_id)
    )
  );

create policy "session_day_votes: own delete"
  on session_day_votes for delete using (
    user_id = (select u.id from users u where u.id::text = auth.uid()::text)
  );
