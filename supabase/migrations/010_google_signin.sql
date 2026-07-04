-- Google Sign-In gives us name/email/picture but never a phone number, so
-- phone can no longer be mandatory. The unique constraint still holds —
-- Postgres treats every NULL as distinct, so multiple Google-only users
-- with no phone don't collide.
alter table users alter column phone drop not null;
