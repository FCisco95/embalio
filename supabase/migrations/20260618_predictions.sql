-- P4: prediction receipts — every trajectory / weekly-forecast / breakout output
-- is persisted here for accuracy receipts + backtesting. value_json holds the
-- full validated output (schema mirrored in src/lib/predict/schemas.ts).
-- Service-role only (RLS disabled, same posture as analytics_daily + the signal
-- warehouse; revisit in P7 hardening).
create table if not exists public.predictions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('trajectory', 'weekly_forecast', 'breakout')),
  value_json  jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);
create index if not exists predictions_profile_type_created
  on public.predictions (profile_id, type, created_at desc);
alter table public.predictions disable row level security;
