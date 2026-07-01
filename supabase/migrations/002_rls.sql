-- ─── HELPER: is the requesting JWT user a member of this group? ───────────────
-- Used in every private-table policy. Uses auth.uid() which is the 'sub' claim
-- from the JWT we mint server-side after Firebase OTP verification.
create or replace function is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid
      and user_id  = (select id from users where id::text = auth.uid()::text)
  )
$$;

-- ─── USERS ───────────────────────────────────────────────────────────────────
alter table users enable row level security;

-- Anyone can read basic user info (needed to render group member lists).
create policy "users: read any"
  on users for select using (true);

-- A user can only update their own profile.
create policy "users: update own"
  on users for update using (id::text = auth.uid()::text);

-- Insert is handled server-side (service role) during the auth exchange.
-- No direct client inserts allowed.

-- ─── GROUPS ──────────────────────────────────────────────────────────────────
alter table groups enable row level security;

-- Only members can read a group.
create policy "groups: members can read"
  on groups for select using (is_group_member(id));

-- Any authenticated user can create a group (they'll be auto-added as admin).
create policy "groups: authenticated can create"
  on groups for insert with check (auth.uid() is not null);

-- Only admins can update group details.
create policy "groups: admins can update"
  on groups for update using (
    exists (
      select 1 from group_members
      where group_id = id
        and user_id  = (select u.id from users u where u.id::text = auth.uid()::text)
        and role     = 'admin'
    )
  );

-- ─── GROUP MEMBERS ───────────────────────────────────────────────────────────
alter table group_members enable row level security;

-- Members can see other members of the same group.
create policy "group_members: members can read own group"
  on group_members for select using (is_group_member(group_id));

-- Insert allowed when joining via invite (user_id must match the requester).
create policy "group_members: can join own"
  on group_members for insert with check (
    user_id = (select u.id from users u where u.id::text = auth.uid()::text)
  );

-- Admins can remove members.
create policy "group_members: admins can delete"
  on group_members for delete using (
    exists (
      select 1 from group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id  = (select u.id from users u where u.id::text = auth.uid()::text)
        and gm.role     = 'admin'
    )
  );

-- ─── TURFS (global — no ownership checks) ────────────────────────────────────
alter table turfs enable row level security;

-- Any authenticated user can read all turfs.
create policy "turfs: authenticated can read"
  on turfs for select using (auth.uid() is not null);

-- Any authenticated user can add a turf.
create policy "turfs: authenticated can insert"
  on turfs for insert with check (auth.uid() is not null);

-- ─── TURF RATINGS (global) ───────────────────────────────────────────────────
alter table turf_ratings enable row level security;

create policy "turf_ratings: authenticated can read"
  on turf_ratings for select using (auth.uid() is not null);

create policy "turf_ratings: own insert"
  on turf_ratings for insert with check (
    rater_user_id = (select u.id from users u where u.id::text = auth.uid()::text)
  );

-- ─── SESSIONS ────────────────────────────────────────────────────────────────
alter table sessions enable row level security;

create policy "sessions: members can read"
  on sessions for select using (is_group_member(group_id));

create policy "sessions: members can create"
  on sessions for insert with check (is_group_member(group_id));

-- Organizer or group admin can update.
create policy "sessions: organizer or admin can update"
  on sessions for update using (
    organizer_id = (select u.id from users u where u.id::text = auth.uid()::text)
    or exists (
      select 1 from group_members gm
      where gm.group_id = sessions.group_id
        and gm.user_id  = (select u.id from users u where u.id::text = auth.uid()::text)
        and gm.role     = 'admin'
    )
  );

-- ─── SESSION VOTES ───────────────────────────────────────────────────────────
alter table session_votes enable row level security;

create policy "session_votes: members can read"
  on session_votes for select using (
    exists (
      select 1 from sessions s where s.id = session_id and is_group_member(s.group_id)
    )
  );

create policy "session_votes: members can vote"
  on session_votes for insert with check (
    user_id = (select u.id from users u where u.id::text = auth.uid()::text)
    and exists (
      select 1 from sessions s where s.id = session_id and is_group_member(s.group_id)
    )
  );

create policy "session_votes: own update"
  on session_votes for update using (
    user_id = (select u.id from users u where u.id::text = auth.uid()::text)
  );

create policy "session_votes: own delete"
  on session_votes for delete using (
    user_id = (select u.id from users u where u.id::text = auth.uid()::text)
  );

-- ─── SESSION WAITLIST ────────────────────────────────────────────────────────
alter table session_waitlist enable row level security;

create policy "session_waitlist: members can read"
  on session_waitlist for select using (
    exists (
      select 1 from sessions s where s.id = session_id and is_group_member(s.group_id)
    )
  );

-- Server-side only (service role manages waitlist), no direct client inserts.

-- ─── ATTENDANCE ──────────────────────────────────────────────────────────────
alter table attendance enable row level security;

create policy "attendance: members can read"
  on attendance for select using (
    exists (
      select 1 from sessions s where s.id = session_id and is_group_member(s.group_id)
    )
  );

-- Organizer or group admin marks attendance.
create policy "attendance: organizer or admin can write"
  on attendance for insert with check (
    exists (
      select 1 from sessions s
      where s.id = session_id
        and (
          s.organizer_id = (select u.id from users u where u.id::text = auth.uid()::text)
          or exists (
            select 1 from group_members gm
            where gm.group_id = s.group_id
              and gm.user_id  = (select u.id from users u where u.id::text = auth.uid()::text)
              and gm.role     = 'admin'
          )
        )
    )
  );

create policy "attendance: organizer or admin can update"
  on attendance for update using (
    exists (
      select 1 from sessions s
      where s.id = session_id
        and (
          s.organizer_id = (select u.id from users u where u.id::text = auth.uid()::text)
          or exists (
            select 1 from group_members gm
            where gm.group_id = s.group_id
              and gm.user_id  = (select u.id from users u where u.id::text = auth.uid()::text)
              and gm.role     = 'admin'
          )
        )
    )
  );

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
alter table payments enable row level security;

create policy "payments: members can read"
  on payments for select using (
    exists (
      select 1 from sessions s where s.id = session_id and is_group_member(s.group_id)
    )
  );

-- Payer marks their own payment.
create policy "payments: payer can update own"
  on payments for update using (
    payer_id = (select u.id from users u where u.id::text = auth.uid()::text)
  );

-- Session payments created server-side when attendance is locked.

-- ─── SESSION CAPTAINS ────────────────────────────────────────────────────────
alter table session_captains enable row level security;

create policy "session_captains: members can read"
  on session_captains for select using (
    exists (
      select 1 from sessions s where s.id = session_id and is_group_member(s.group_id)
    )
  );

-- ─── MATCH RATINGS ───────────────────────────────────────────────────────────
alter table match_ratings enable row level security;

-- Aggregates visible to members; individual rater_user_id never exposed in the UI
-- but is stored here for audit. RLS only gates the query, not the column.
create policy "match_ratings: members can read aggregates"
  on match_ratings for select using (
    exists (
      select 1 from sessions s where s.id = session_id and is_group_member(s.group_id)
    )
  );

create policy "match_ratings: members can rate"
  on match_ratings for insert with check (
    rater_user_id = (select u.id from users u where u.id::text = auth.uid()::text)
    and exists (
      select 1 from sessions s where s.id = session_id and is_group_member(s.group_id)
    )
  );
