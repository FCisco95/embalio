-- P3: daily account analytics imported from the native X CSV export — the ONLY
-- source for profile visits + new follows (X exposes neither via API).
-- Service-role only (RLS disabled, same posture as the signal warehouse;
-- revisit in P7 hardening). Re-imports upsert on (profile_id, date).
create table if not exists public.analytics_daily (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  date           date not null,
  profile_visits int not null default 0,
  new_follows    int not null default 0,
  unfollows      int,
  impressions    int,
  engagements    int,
  likes          int,
  replies        int,
  reposts        int,
  bookmarks      int,
  shares         int,
  imported_at    timestamptz not null default now(),
  unique (profile_id, date)
);
create index if not exists analytics_daily_profile_date
  on public.analytics_daily (profile_id, date desc);
alter table public.analytics_daily disable row level security;
