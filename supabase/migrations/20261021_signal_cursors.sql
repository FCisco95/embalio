-- 2026-10 revamp, Day-0 contract (4/5): incremental read cursors for the X API
-- signal source. `since_id` per (profile, handle-set) keeps search/recent reads
-- to new posts only; pay-per-use charges per post returned.
-- key = `${profile_id}:xapi:${sha256(sorted handles).slice(0,16)}`.
-- Plan: docs/superpowers/plans/2026-10-21-revamp-plan.md (section 5)

create table if not exists public.signal_cursors (
  key        text primary key,
  since_id   text not null,
  updated_at timestamptz not null default now()
);

alter table public.signal_cursors enable row level security;
revoke all privileges on table public.signal_cursors from anon, authenticated;
