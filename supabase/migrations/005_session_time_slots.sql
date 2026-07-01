-- Turf bookings are a time range (9-10, 9-11, 8:30-10:30), not just a start
-- moment. Add an end time alongside the existing start time, on both the
-- locked-in session and each day-poll candidate (so a proposed day carries
-- its own full slot, not just a date).
alter table sessions add column ends_at timestamptz;
alter table session_day_options add column ends_at timestamptz;
