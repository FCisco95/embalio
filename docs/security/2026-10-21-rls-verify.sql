-- READ ONLY: concise receipt after containment/link/recovery.
-- Replace NULL with the independently verified Authentication -> Users UUID.
with expected_owner(id) as (values(null::uuid)), expected(table_name,access_model) as (
  values ('profiles','owner'),('seed_targets','owner'),('candidates','owner'),
    ('drafts','owner'),('posts','owner'),('posting_accounts','owner'),
    ('posting_jobs','owner'),('research_briefings','owner'),('watch_targets','owner'),
    ('sniper_alerts','owner'),('push_subscriptions','owner'),
    ('signal_tweets','internal'),('tweet_metric_snapshots','internal'),
    ('activity_events','internal'),('topic_history','internal'),('follower_snapshots','internal'),
    ('analytics_daily','internal'),('predictions','internal'),('strategy_snapshots','internal')
), inventory as (
  select e.*,c.oid,c.relrowsecurity from expected e
  left join pg_namespace n on n.nspname='public'
  left join pg_class c on c.relnamespace=n.oid and c.relname=e.table_name and c.relkind in ('r','p')
)
select jsonb_build_object(
  'checked_at',now(),
  'expected_tables',19,
  'tables_found',(select count(oid) from inventory),
  'tables_with_rls',(select count(*) from inventory where relrowsecurity),
  'anon_accessible_tables',(select count(*) from inventory where
    has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    or has_any_column_privilege('anon',oid,'SELECT,INSERT,UPDATE,REFERENCES')),
  'authenticated_internal_access',(select count(*) from inventory where access_model='internal' and
    (has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE')
    or has_any_column_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,REFERENCES'))),
  'authenticated_admin_privileges',(select count(*) from inventory where
    has_table_privilege('authenticated',oid,'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')),
  'primary_owner_verified',case when (select id from expected_owner) is null then null else
    (select count(*)=1 and coalesce(bool_and(user_id=(select id from expected_owner)),false)
    from public.profiles where lower(ltrim(btrim(handle),'@'))='fcisco95') end,
  'profiles',(select count(*) from public.profiles),
  'unlinked_profiles',(select count(*) from public.profiles where user_id is null)
) as rls_verification;
