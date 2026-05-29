-- Research briefings cache: one row per profile per day
create table if not exists public.research_briefings (
  id         uuid primary key default gen_random_uuid(),
  profile_id text not null,
  date       date not null,
  summary    text not null default '',
  topics     jsonb not null default '[]'::jsonb,
  raw_data   jsonb,
  created_at timestamptz not null default now(),
  constraint research_briefings_profile_date_key unique (profile_id, date)
);

-- No RLS needed (service-role only)
alter table public.research_briefings disable row level security;
