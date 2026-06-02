-- 0009_recording_profiles.sql
-- Per-device recording configuration, synced across machines via Supabase.
create table if not exists recording_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  device_label text not null,
  os text not null,                       -- 'windows' | 'macos'
  monitors jsonb not null default '[]',   -- [{ resolution, role }]
  capture_tool text not null,             -- 'OBS+Rapidemo' | 'OBS'
  mic text,
  webcam text,
  teleprompter_placement text not null default 'top-center',
  scene_presets jsonb not null default '[]',
  export_path text,
  sync_target text,
  created_at timestamptz not null default now()
);
create index if not exists recording_profiles_profile_id_idx on recording_profiles(profile_id);

alter table recording_profiles enable row level security;
drop policy if exists recording_profiles_owner on recording_profiles;
create policy recording_profiles_owner on recording_profiles
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where user_id = auth.uid())
  );
