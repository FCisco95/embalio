-- Signal warehouse: global proprietary dataset. Service-role only (like research_briefings).
create table if not exists public.signal_tweets (
  id               uuid primary key default gen_random_uuid(),
  source           text not null,
  source_tweet_id  text not null unique,
  author_handle    text not null,
  author_followers int  not null default 0,
  text             text not null default '',
  url              text not null default '',
  lang             text,
  tweet_created_at timestamptz,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  deleted_at       timestamptz,
  raw              jsonb
);
create index if not exists signal_tweets_author_idx
  on public.signal_tweets (author_handle, tweet_created_at desc);
alter table public.signal_tweets disable row level security;

-- Metric time series: snapshots, never updates-in-place — velocity lives in the deltas.
create table if not exists public.tweet_metric_snapshots (
  id              uuid primary key default gen_random_uuid(),
  signal_tweet_id uuid not null references public.signal_tweets(id) on delete cascade,
  captured_at     timestamptz not null default now(),
  likes           int not null default 0,
  views           int not null default 0,
  replies         int not null default 0,
  reposts         int,
  bookmarks       int
);
create index if not exists tweet_metric_snapshots_tweet_idx
  on public.tweet_metric_snapshots (signal_tweet_id, captured_at desc);
alter table public.tweet_metric_snapshots disable row level security;

-- App-action ledger: powers activity counters (P3 KPIs) + sniper alert idempotency (P5).
create table if not exists public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in
    ('reply_posted','post_published','engage_done','draft_created',
     'csv_imported','sniper_alert_sent','sniper_alert_acted','scan_run')),
  ref_id     text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_events_profile_idx
  on public.activity_events (profile_id, created_at desc);
alter table public.activity_events disable row level security;

-- Topic boards persisted (P2 reads/writes; created now so the migration batch is one).
create table if not exists public.topic_history (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  topic        text not null,
  angle        text,
  score        int,
  why          jsonb not null default '{}'::jsonb,
  sources      jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at   timestamptz,
  status       text not null default 'fresh'
);
create index if not exists topic_history_profile_idx
  on public.topic_history (profile_id, generated_at desc);
alter table public.topic_history disable row level security;

-- Daily follower counts. One row per profile per day per source.
create table if not exists public.follower_snapshots (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null default (now()::date),
  captured_at   timestamptz not null default now(),
  followers     int not null,
  following     int,
  source        text not null default 'scrape' check (source in ('csv','scrape','manual')),
  annotation    text,
  unique (profile_id, snapshot_date, source)
);
alter table public.follower_snapshots disable row level security;
