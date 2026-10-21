-- READ ONLY. Run in Embalio's SQL Editor and copy/export the single JSON result.
-- Contains table/policy/grant metadata and ownership counts, not profile content,
-- emails, tokens, subscriptions or any other application rows.
-- Optional but required before recovery: replace NULL below with the expected
-- auth UUID copied from Authentication -> Users, not inferred from profiles.
-- The output reports only whether it matches; it does not print that UUID.
with expected_owner(id) as (values(null::uuid)), expected(table_name, access_model) as (
  values
    ('profiles','owner'),('seed_targets','owner'),('candidates','owner'),
    ('drafts','owner'),('posts','owner'),('posting_accounts','owner'),
    ('posting_jobs','owner'),('research_briefings','owner'),
    ('watch_targets','owner'),('sniper_alerts','owner'),('push_subscriptions','owner'),
    ('signal_tweets','internal'),('tweet_metric_snapshots','internal'),
    ('activity_events','internal'),('topic_history','internal'),
    ('follower_snapshots','internal'),('analytics_daily','internal'),
    ('predictions','internal'),('strategy_snapshots','internal')
), inventory as (
  select e.table_name,e.access_model,c.oid,c.relrowsecurity as rls_enabled,
    pg_get_userbyid(c.relowner) as table_owner,
    has_table_privilege('anon',c.oid,'SELECT') as anon_select,
    has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') as anon_write,
    has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
    has_table_privilege('authenticated',c.oid,'TRUNCATE') as authenticated_truncate,
    coalesce((select jsonb_agg(jsonb_build_object('role',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
      'privilege',a.privilege_type,'grant_option',a.is_grantable))
      from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),'[]'::jsonb) as table_grants,
    coalesce((select jsonb_agg(jsonb_build_object('column',att.attname,
      'role',case when g.grantee=0 then 'PUBLIC' else pg_get_userbyid(g.grantee) end,'privilege',g.privilege_type))
      from pg_attribute att cross join lateral aclexplode(att.attacl) g
      where att.attrelid=c.oid and att.attnum>0 and not att.attisdropped),'[]'::jsonb) as column_grants,
    coalesce((select jsonb_agg(jsonb_build_object(
      'name',p.policyname,'mode',p.permissive,'roles',p.roles,'command',p.cmd,
      'using',p.qual,'with_check',p.with_check) order by p.policyname)
      from pg_policies p where p.schemaname='public' and p.tablename=e.table_name),'[]'::jsonb) as policies
  from expected e
  left join pg_namespace n on n.nspname='public'
  left join pg_class c on c.relnamespace=n.oid and c.relname=e.table_name and c.relkind in ('r','p')
), child_links(table_name,profile_id) as (
  select 'seed_targets',profile_id::text from public.seed_targets union all
  select 'candidates',profile_id::text from public.candidates union all
  select 'drafts',profile_id::text from public.drafts union all
  select 'posts',profile_id::text from public.posts union all
  select 'posting_accounts',profile_id::text from public.posting_accounts union all
  select 'posting_jobs',profile_id::text from public.posting_jobs union all
  select 'research_briefings',profile_id::text from public.research_briefings union all
  select 'watch_targets',profile_id::text from public.watch_targets union all
  select 'sniper_alerts',profile_id::text from public.sniper_alerts union all
  select 'push_subscriptions',profile_id::text from public.push_subscriptions
), child_ownership as (
  select r.table_name,count(*) as rows,
    count(*) filter(where r.profile_id is null) as null_profile_ids,
    count(*) filter(where r.profile_id is not null and p.id is null) as unmatched_profile_ids
  from child_links r left join public.profiles p on p.id::text=r.profile_id
  group by r.table_name
), ownership as (
  select count(*) as profiles,
    count(*) filter(where p.user_id is null) as unlinked_profiles,
    count(*) filter(where p.user_id is not null and not exists
      (select 1 from auth.users u where u.id::text=p.user_id::text)) as orphaned_profiles,
    count(*) filter(where lower(ltrim(p.handle,'@'))='fcisco95') as primary_profiles,
    count(*) filter(where lower(ltrim(p.handle,'@'))='fcisco95' and exists
      (select 1 from auth.users u where u.id::text=p.user_id::text)) as primary_linked_profiles
  from public.profiles p
)
select jsonb_build_object(
  'checked_at',now(),
  'checked_as',current_user,
  'postgres_version',current_setting('server_version'),
  'tables',coalesce((select jsonb_agg(to_jsonb(i) order by i.table_name) from inventory i),'[]'::jsonb),
  'profile_ownership',(select to_jsonb(o) from ownership o),
  'child_ownership',coalesce((select jsonb_agg(to_jsonb(c) order by c.table_name) from child_ownership c),'[]'::jsonb),
  'profile_user_default',(select pg_get_expr(d.adbin,d.adrelid)
    from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
    where a.attrelid='public.profiles'::regclass and a.attname='user_id'),
  'primary_owner_verified',case when (select id from expected_owner) is null then null else
    (select count(*)=1 and coalesce(bool_and(user_id=(select id from expected_owner)),false) from public.profiles
      where lower(ltrim(btrim(handle),'@'))='fcisco95') end,
  'roles',(select jsonb_agg(jsonb_build_object('role',r.rolname,'superuser',r.rolsuper,'bypassrls',r.rolbypassrls,
    'member_of',coalesce((select jsonb_agg(pg_get_userbyid(m.roleid)) from pg_auth_members m where m.member=r.oid),'[]'::jsonb)))
    from pg_roles r where r.rolname in ('anon','authenticated','service_role')),
  'other_public_tables_without_rls',(select coalesce(jsonb_agg(c.relname order by c.relname),'[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
      and c.relname not in (select table_name from expected))
) as rls_preflight;
