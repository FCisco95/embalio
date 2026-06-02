-- 0013_profiles_channel_playbook.sql
-- The synthesized Channel Playbook (strategic path), mirrors profiles.growth_plan.
alter table profiles add column if not exists channel_playbook jsonb;
