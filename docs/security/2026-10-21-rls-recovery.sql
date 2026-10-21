-- REVIEW CANDIDATE. Not applied to production by the agent.
-- Run 2026-10-21-rls-preflight.sql and review owner links/policies first.
-- Repairs only the 19 tables shown in the Embalio Security Advisor screenshot.
-- Does not change user data, auth users, credentials, defaults for future tables,
-- schema history, X integration or any October revamp contract columns.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- This does not bypass RLS: it makes filtered administrative reads fail rather
-- than silently overlooking profiles while checking their ownership.
set local row_security = off;

do $recovery$
declare
  -- REQUIRED: replace NULL with the expected auth.users UUID independently
  -- verified in Authentication -> Users. Never infer it from exposed profiles.
  expected_primary_owner uuid := null;
  -- Set true ONLY to preserve other unlinked profiles/data in quarantine:
  -- authenticated users cannot see them; their user_id is never reassigned.
  -- The primary fcisco95 profile must still match the verified owner below.
  quarantine_unlinked_profiles boolean := false;
  owned_tables text[] := array[
    'profiles','seed_targets','candidates','drafts','posts','posting_accounts',
    'posting_jobs','research_briefings','watch_targets','sniper_alerts','push_subscriptions'
  ];
  internal_tables text[] := array[
    'signal_tweets','tweet_metric_snapshots','activity_events','topic_history',
    'follower_snapshots','analytics_daily','predictions','strategy_snapshots'
  ];
  t text;
  predicate text;
  existing_default text;
  unmatched_rows boolean;
begin
  if expected_primary_owner is null then
    raise exception 'RLS recovery preflight: set the independently verified primary auth user UUID first';
  end if;
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then
    raise exception 'RLS recovery preflight: expected Supabase auth schema/functions';
  end if;
  if (select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')) <> 3 then
    raise exception 'RLS recovery preflight: expected Supabase roles';
  end if;
  if exists (select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) then
    raise exception 'RLS recovery preflight: anon/authenticated bypass RLS; review role configuration';
  end if;
  if not exists (select 1 from pg_roles where rolname='service_role' and rolbypassrls) then
    raise exception 'RLS recovery preflight: service_role must retain its expected BYPASSRLS attribute';
  end if;

  -- Validate the complete set before changing any policy or grant.
  foreach t in array owned_tables || internal_tables loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=t and c.relkind in ('r','p')
    ) then
      raise exception 'RLS recovery preflight: missing expected public table %',t;
    end if;
    if t=any(owned_tables) and t <> 'profiles' and not exists (
      select 1 from pg_attribute where attrelid=format('public.%I',t)::regclass
        and attname='profile_id' and not attisdropped
    ) then
      raise exception 'RLS recovery preflight: missing public.%.profile_id',t;
    end if;
  end loop;
  if not exists (
    select 1 from pg_attribute where attrelid='public.profiles'::regclass
      and attname='user_id' and atttypid='uuid'::regtype and not attisdropped
  ) then
    raise exception 'RLS recovery preflight: profiles.user_id must be uuid; inspect schema drift';
  end if;

  -- Stabilize the owner links while the transaction changes authorization.
  foreach t in array owned_tables || internal_tables loop
    execute format('lock table public.%I in share row exclusive mode',t);
  end loop;
  if exists (
    select 1 from public.profiles p
    where (p.user_id is null and not quarantine_unlinked_profiles)
      or (p.user_id is not null and not exists (select 1 from auth.users u where u.id=p.user_id))
  ) then
    raise exception 'RLS recovery preflight: unlinked/orphaned profiles; review ownership first, do not delete or guess owners';
  end if;
  if (select count(*) from public.profiles where lower(ltrim(btrim(handle),'@'))='fcisco95') <> 1
     or not exists (select 1 from public.profiles where lower(ltrim(btrim(handle),'@'))='fcisco95' and user_id=expected_primary_owner) then
    raise exception 'RLS recovery preflight: primary profile does not match the independently verified auth user';
  end if;
  foreach t in array owned_tables loop
    if t <> 'profiles' then
      execute format(
        'select exists(select 1 from public.%I r where r.profile_id is null or not exists(select 1 from public.profiles p where p.id::text=r.profile_id::text))',t
      ) into unmatched_rows;
      if unmatched_rows then
        raise exception 'RLS recovery preflight: unmatched/null/noncanonical profile_id values in public.%; review these rows first',t;
      end if;
    end if;
  end loop;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_roles r on r.oid=c.relowner
    where n.nspname='public' and c.relname=any(owned_tables || internal_tables)
      and r.rolname not in ('postgres','supabase_admin') and not (r.rolsuper or r.rolbypassrls)
  ) then
    raise exception 'RLS recovery preflight: unexpected table owner; review ownership/role memberships first';
  end if;
  if exists (
    select 1 from (
      select c.relowner,a.grantee from pg_class c join pg_namespace n on n.oid=c.relnamespace
      cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where n.nspname='public' and c.relname=any(owned_tables || internal_tables)
      union all
      select c.relowner,g.grantee from pg_class c join pg_namespace n on n.oid=c.relnamespace
      join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
      cross join lateral aclexplode(a.attacl) g
      where n.nspname='public' and c.relname=any(owned_tables || internal_tables)
    ) grants
    left join pg_roles r on r.oid=grants.grantee
    where grants.grantee <> 0 and grants.grantee <> grants.relowner
      and coalesce(r.rolname,'') not in ('anon','authenticated','service_role')
      and not coalesce(r.rolsuper or r.rolbypassrls,false)
  ) then
    raise exception 'RLS recovery preflight: unexpected custom table/column grantee; review grants first';
  end if;
  if exists (
    select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any(owned_tables)
      and not p.polpermissive and p.polname <> 'embalio_owner_guard'
  ) then
    raise exception 'RLS recovery preflight: existing restrictive policies require review';
  end if;

  select pg_get_expr(d.adbin,d.adrelid) into existing_default
    from pg_attrdef d join pg_attribute a
      on a.attrelid=d.adrelid and a.attnum=d.adnum
    where a.attrelid='public.profiles'::regclass and a.attname='user_id';
  if existing_default is not null and existing_default <> 'auth.uid()' then
    raise exception 'RLS recovery preflight: unexpected profiles.user_id default; review it first';
  end if;
  -- createProfile omits user_id; restore the declared default only when absent.
  if existing_default is null then
    alter table public.profiles alter column user_id set default auth.uid();
  end if;

  foreach t in array owned_tables || internal_tables loop
    execute format('alter table public.%I enable row level security',t);
    -- RLS does not govern TRUNCATE. Remove direct/PUBLIC grants, then restore
    -- only declared CRUD. Surviving effective/inherited rights are checked LAST.
    execute format('revoke all privileges on table public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update, delete on table public.%I to service_role',t);
  end loop;

  foreach t in array owned_tables loop
    if t='profiles' then
      predicate := 'user_id = (select auth.uid())';
    else
      -- research_briefings historically used text profile_id. Comparing text
      -- avoids an unrelated type conversion/FK migration during recovery.
      predicate := format(
        'exists (select 1 from public.profiles p where p.id::text = %I.profile_id::text and p.user_id = (select auth.uid()))',t
      );
    end if;
    execute format('grant select, insert, update, delete on table public.%I to authenticated',t);
    execute format('drop policy if exists embalio_owner_access on public.%I',t);
    execute format('drop policy if exists embalio_owner_guard on public.%I',t);
    execute format(
      'create policy embalio_owner_access on public.%I as permissive for all to authenticated using (%s) with check (%s)',
      t,predicate,predicate
    );
    -- A legacy permissive USING(true) would otherwise OR around a new owner
    -- policy. This guard constrains it without deleting unrelated policies.
    execute format(
      'create policy embalio_owner_guard on public.%I as restrictive for all to public using (%s) with check (%s)',
      t,predicate,predicate
    );
  end loop;
  foreach t in array internal_tables loop
    execute format('drop policy if exists embalio_internal_guard on public.%I',t);
    execute format('create policy embalio_internal_guard on public.%I as restrictive for all to public using(false) with check(false)',t);
  end loop;
  -- Run only after ALL grants: e.g. anon might inherit authenticated, and
  -- restoring the latter's CRUD must not silently reopen anonymous access.
  foreach t in array owned_tables || internal_tables loop
    if has_table_privilege('anon',format('public.%I',t),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
       or has_any_column_privilege('anon',format('public.%I',t),'SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception 'RLS recovery preflight: anon retains inherited/grantor privileges on public.%',t;
    end if;
    if has_table_privilege('authenticated',format('public.%I',t),'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') then
      raise exception 'RLS recovery preflight: authenticated retains inherited non-CRUD privileges on public.%',t;
    end if;
    if t=any(internal_tables) and (
      has_table_privilege('authenticated',format('public.%I',t),'SELECT,INSERT,UPDATE,DELETE')
      or has_any_column_privilege('authenticated',format('public.%I',t),'SELECT,INSERT,UPDATE,REFERENCES')
    ) then
      raise exception 'RLS recovery preflight: authenticated retains inherited access to internal public.%',t;
    end if;
  end loop;
end
$recovery$;

commit;
