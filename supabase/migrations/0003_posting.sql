create table posting_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  adspower_user_id text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id)
);

create table posting_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  draft_id uuid references drafts(id) on delete set null,
  method text not null default 'adspower' check (method in ('adspower')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed')),
  result_url text,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on posting_jobs (profile_id, created_at desc);

alter table posting_accounts enable row level security;
alter table posting_jobs     enable row level security;

create policy "own posting_accounts" on posting_accounts for all
  using (exists (select 1 from profiles p where p.id = posting_accounts.profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = posting_accounts.profile_id and p.user_id = auth.uid()));

create policy "own posting_jobs" on posting_jobs for all
  using (exists (select 1 from profiles p where p.id = posting_jobs.profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = posting_jobs.profile_id and p.user_id = auth.uid()));
