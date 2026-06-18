-- P6: weekly strategy snapshots — cluster position, target picks, reply→follow
-- attribution (correlation-labeled), and recommended adds/drops. snapshot_json
-- holds the full validated StrategySnapshot (schema in src/lib/strategy/schemas.ts).
-- Service-role only (RLS disabled, same posture as predictions + signal warehouse;
-- revisit in P7 hardening).
create table if not exists public.strategy_snapshots (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  week_of       date not null,
  snapshot_json jsonb not null,
  created_at    timestamptz not null default now()
);
create unique index if not exists strategy_snapshots_profile_week
  on public.strategy_snapshots (profile_id, week_of);
create index if not exists strategy_snapshots_profile_created
  on public.strategy_snapshots (profile_id, created_at desc);
alter table public.strategy_snapshots disable row level security;
