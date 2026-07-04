-- Turfs stay global (per brief §3), but a group can now save turfs to its own
-- shortlist without organizing a session first. The picker's "this group's
-- turfs" tier becomes: saved links ∪ turfs used in past sessions.
create table group_turfs (
  group_id   uuid references groups(id) on delete cascade,
  turf_id    uuid references turfs(id) on delete cascade,
  added_by   uuid references users(id),
  created_at timestamptz default now(),
  primary key (group_id, turf_id)
);

alter table group_turfs enable row level security;

create policy "group_turfs: members can read"
  on group_turfs for select using (is_group_member(group_id));

create policy "group_turfs: members can add"
  on group_turfs for insert with check (is_group_member(group_id));

-- Removing only unlinks the turf from the group's shortlist — the global
-- turf row (and other groups' links to it) are untouched.
create policy "group_turfs: members can remove"
  on group_turfs for delete using (is_group_member(group_id));
