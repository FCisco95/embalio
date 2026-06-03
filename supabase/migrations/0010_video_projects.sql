-- 0010_video_projects.sql
-- The spine: one row per video, threaded through pipeline stages.
create table if not exists video_projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  stage text not null default 'topic',    -- topic|script|record|publish|repurposed
  topic jsonb,                             -- RankedTopic
  script jsonb,                            -- VideoScript
  recording jsonb,                         -- { recording_profile_id, take_confirmed_at, notes }
  publish jsonb,                           -- { youtube_video_id, url, privacy_status, published_at }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists video_projects_profile_id_idx on video_projects(profile_id);

alter table video_projects enable row level security;
drop policy if exists video_projects_owner on video_projects;
create policy video_projects_owner on video_projects for all
  using (exists (select 1 from profiles p where p.id = video_projects.profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = video_projects.profile_id and p.user_id = auth.uid()));
