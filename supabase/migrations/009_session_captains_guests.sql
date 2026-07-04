-- Guests now get their own independent team slot instead of silently
-- following whoever brought them — headcount/capacity/payments already treat
-- a guest as a real player, teams should balance the same way. A guest row
-- has no users(id) (they're not an account), so it carries a name label and
-- a pointer to the member who invited them instead.
alter table session_captains add column guest_name text;
alter table session_captains add column invited_by uuid references users(id);

alter table session_captains add constraint session_captains_member_or_guest check (
  (user_id is not null and guest_name is null and invited_by is null) or
  (user_id is null and guest_name is not null and invited_by is not null)
);
