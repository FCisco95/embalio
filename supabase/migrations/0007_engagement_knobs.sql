-- 0007_engagement_knobs.sql
-- Engine knobs collected by setup but previously unpersisted.
alter table profiles add column if not exists account_size text;
alter table profiles add column if not exists daily_capacity text;
alter table profiles add column if not exists reply_playbook text;
