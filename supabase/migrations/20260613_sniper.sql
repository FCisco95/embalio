-- P5 sniper-lite: watch list, alert ledger, web-push subscriptions.
-- Same service-role posture as the signal warehouse (RLS disabled; P7 hardening item).

create table if not exists public.watch_targets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  handle text not null,
  priority int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id, handle)
);
create index if not exists watch_targets_profile_idx on public.watch_targets (profile_id) where active;
alter table public.watch_targets disable row level security;

create table if not exists public.sniper_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_tweet_id text not null,
  author_handle text not null,
  tweet_text text not null,
  tweet_url text not null,
  score numeric not null,
  score_parts jsonb not null default '{}'::jsonb,
  latency_ms bigint not null,
  channels jsonb not null default '{}'::jsonb,
  status text not null default 'sent' check (status in ('sent','acted','dismissed')),
  created_at timestamptz not null default now(),
  unique (profile_id, source_tweet_id)
);
create index if not exists sniper_alerts_profile_recent_idx on public.sniper_alerts (profile_id, created_at desc);
alter table public.sniper_alerts disable row level security;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions disable row level security;
