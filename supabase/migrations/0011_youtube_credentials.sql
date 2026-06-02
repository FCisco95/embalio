-- 0011_youtube_credentials.sql
-- OAuth refresh token for videos.insert. Service-role only; never read via anon/RLS.
create table if not exists youtube_credentials (
  profile_id uuid primary key references profiles(id) on delete cascade,
  refresh_token text not null,
  scope text,
  obtained_at timestamptz not null default now()
);
alter table youtube_credentials enable row level security;
-- No anon policy on purpose: only the service-role client (which bypasses RLS) touches this table.
