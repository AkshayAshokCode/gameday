-- The original "can join own" policy only checked user_id = self, leaving role
-- unconstrained — any authenticated user could insert themselves as 'admin' into
-- any group by ID. Self-service joins must always land as 'member'; admin rows
-- are only ever created server-side (service role, bypassing RLS) during group
-- creation or promotion.
drop policy "group_members: can join own" on group_members;

create policy "group_members: can join own"
  on group_members for insert with check (
    user_id = (select u.id from users u where u.id::text = auth.uid()::text)
    and role = 'member'
  );
