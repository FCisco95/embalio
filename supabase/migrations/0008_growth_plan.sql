-- 0008_growth_plan.sql
-- The saved Growth Plan artifact produced at the end of setup.
alter table profiles add column if not exists growth_plan jsonb;
