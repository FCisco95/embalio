-- 0012_algorithm_briefs.sql
-- History of live-researched YouTube-algorithm best-practices briefs. One row
-- PER research run (intentionally NOT unique on profile_id) — keeps an audit
-- trail of sources; the freshness "cache" is just the most recent row per
-- profile (see runAlgorithmBrief). Service-role only (RLS on, no anon policy)
-- — mirrors youtube_credentials.
create table if not exists algorithm_briefs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  brief jsonb not null,
  researched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists algorithm_briefs_profile_researched_idx
  on algorithm_briefs (profile_id, researched_at desc);
alter table algorithm_briefs enable row level security;
