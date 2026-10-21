-- 2026-10 revamp, Day-0 contract (5/5): API-sourced read-out + wizard insights.
-- follower_snapshots accepts source='api'; analytics_daily records when the API
-- last touched a row (the CSV columns profile_visits/new_follows stay CSV-owned);
-- profiles.reach_insights holds the onboarding wizard's impressions-by-topic.
-- Plan: docs/superpowers/plans/2026-10-21-revamp-plan.md (sections 6, 7)

-- follower_snapshots.source was created inline (20260611_signal_warehouse.sql):
-- drop whatever check constraint governs it rather than guessing the name.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and rel.relname = 'follower_snapshots'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%source%'
  loop
    execute format('alter table public.follower_snapshots drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.follower_snapshots add constraint follower_snapshots_source_check
  check (source in ('csv','scrape','manual','api'));

alter table public.analytics_daily add column if not exists api_updated_at timestamptz;

alter table public.profiles add column if not exists reach_insights jsonb;
