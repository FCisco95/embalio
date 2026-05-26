create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  handle text not null,
  display_name text,
  niche_description text,
  voice_corpus text[] not null default '{}',
  voice_notes text,
  created_at timestamptz not null default now()
);

create table seed_targets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  handle text,
  list_url text,
  note text,
  active boolean not null default true,
  added_at timestamptz not null default now(),
  check (handle is not null or list_url is not null)
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  source_tweet_id text not null,
  author_handle text not null,
  tweet_text text not null,
  tweet_url text not null,
  metrics_snapshot jsonb not null default '{}',
  score_relevance real,
  score_velocity real,
  score_recency real,
  score_composite real,
  status text not null default 'surfaced'
    check (status in ('surfaced','dismissed','drafted','engaged')),
  pulled_at timestamptz not null default now(),
  unique (profile_id, source_tweet_id)
);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('reply','original')),
  candidate_id uuid references candidates(id) on delete set null,
  body text not null,
  suggested_visual text,
  model_used text,
  status text not null default 'draft'
    check (status in ('draft','approved','posted','skipped')),
  created_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  draft_id uuid references drafts(id) on delete set null,
  tweet_url text not null,
  posted_at timestamptz not null default now(),
  metrics jsonb not null default '{}',
  last_scraped_at timestamptz,
  unique (profile_id, tweet_url)
);

create index on candidates (profile_id, status, score_composite desc);
create index on posts (profile_id, posted_at desc);
