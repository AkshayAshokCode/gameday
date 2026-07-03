-- Payments (Phase 3): per-head cost to compute amounts, a UPI ID per user so
-- whoever is collecting can generate a deep link/QR, and an RLS policy
-- letting the designated collector mark payments on someone else's behalf
-- (the original "payer can update own" policy only covers self-reporting).
alter table sessions add column cost_per_head numeric(10, 2);
alter table users add column upi_id text;

create policy "payments: collector can update"
  on payments for update using (
    collector_id = (select u.id from users u where u.id::text = auth.uid()::text)
  );
