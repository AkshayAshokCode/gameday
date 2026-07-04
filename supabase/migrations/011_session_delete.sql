-- Sessions can now be deleted in-app ("game's cancelled", duplicate created
-- by mistake) — organizer or group admin only, the same pair that can manage
-- the session. Child rows (votes, waitlist, attendance, payments, teams, day
-- options) all cascade with the session.
create policy "sessions: organizer or admin can delete"
  on sessions for delete using (
    organizer_id = (select u.id from users u where u.id::text = auth.uid()::text)
    or exists (
      select 1 from group_members gm
      where gm.group_id = sessions.group_id
        and gm.user_id  = (select u.id from users u where u.id::text = auth.uid()::text)
        and gm.role     = 'admin'
    )
  );
