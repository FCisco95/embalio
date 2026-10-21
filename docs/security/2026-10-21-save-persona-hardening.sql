-- OWNER RUN ONLY. Not part of the revamp migrations.
-- Accepts only the owner-observed production function or this exact hardened body.
-- Any source/contract drift aborts; inspect save-persona-preflight.sql instead.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog;

do $guard$
declare
  target oid := to_regprocedure('public.save_persona(uuid,text,text,text[],jsonb,text[])');
  fn pg_catalog.pg_proc%rowtype;
begin
  if target is null or (select count(*) from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='save_persona') <> 1 then
    raise exception 'save_persona hardening: expected exactly one known function; inspect live definition';
  end if;
  select * into strict fn from pg_catalog.pg_proc where oid=target;
  if fn.prokind <> 'f' or fn.prosecdef or fn.proretset or fn.proisstrict
    or fn.proleakproof or fn.provolatile <> 'v' or fn.proparallel <> 'u'
    or fn.procost <> 100 or fn.prorows <> 0 or fn.prosupport <> 0
    or fn.provariadic <> 0 or fn.pronargdefaults <> 0
    or fn.prorettype <> 'pg_catalog.void'::regtype
    or fn.prolang <> (select oid from pg_catalog.pg_language where lanname='plpgsql')
    or fn.proallargtypes is not null or fn.proargmodes is not null
    or fn.proargnames is distinct from array['p_profile_id','p_voice_spec','p_goals',
      'p_content_pillars','p_onboarding_answers','p_seed_handles']::text[] then
    raise exception 'save_persona hardening: unexpected function contract; inspect live definition';
  end if;
  if exists(select 1 from pg_catalog.unnest(fn.proconfig) setting
    where split_part(setting,'=',1) <> 'search_path') then
    raise exception 'save_persona hardening: unexpected function settings; inspect live definition';
  end if;
  -- Only line endings and outer whitespace are normalized, never SQL tokens.
  if md5(btrim(replace(fn.prosrc,E'\r\n',E'\n'),E' \t\r\n')) not in
    ('12f84eecd67ff0c11eba99f5b04f5ac9','a56ad36d4fc8b0948d0ebd813a18eb48') then
    raise exception 'save_persona hardening: function body differs from reviewed source; inspect live definition';
  end if;
  if not exists(select 1 from pg_catalog.pg_class where oid=to_regclass('public.profiles') and relrowsecurity)
    or not exists(select 1 from pg_catalog.pg_class where oid=to_regclass('public.seed_targets') and relrowsecurity) then
    raise exception 'save_persona hardening: owner tables must already have RLS enabled';
  end if;
end;
$guard$;

create or replace function public.save_persona(
  p_profile_id uuid,
  p_voice_spec text,
  p_goals text,
  p_content_pillars text[],
  p_onboarding_answers jsonb,
  p_seed_handles text[]
) returns void language plpgsql security invoker set search_path = '' as $function$
begin
  update public.profiles
    set voice_spec = p_voice_spec,
        goals = p_goals,
        content_pillars = p_content_pillars,
        onboarding_answers = p_onboarding_answers
    where id = p_profile_id;

  if not found then
    raise exception 'profile % not found', p_profile_id;
  end if;

  insert into public.seed_targets (profile_id, handle)
    select p_profile_id, h
      from pg_catalog.unnest(p_seed_handles) as h
      where h <> ''
  on conflict (profile_id, handle) do nothing;
end;
$function$;

do $verify$
begin
  if not exists(select 1 from pg_catalog.pg_proc
    where oid='public.save_persona(uuid,text,text,text[],jsonb,text[])'::regprocedure
      and not prosecdef and proconfig=array['search_path=""']::text[]
      and md5(btrim(replace(prosrc,E'\r\n',E'\n'),E' \t\r\n'))='a56ad36d4fc8b0948d0ebd813a18eb48') then
    raise exception 'save_persona hardening: final verification failed';
  end if;
end;
$verify$;
commit;

select jsonb_build_object(
  'function','public.save_persona',
  'security_invoker',not prosecdef,
  'search_path_pinned',proconfig=array['search_path=""']::text[],
  'reviewed_body',md5(btrim(replace(prosrc,E'\r\n',E'\n'),E' \t\r\n'))='a56ad36d4fc8b0948d0ebd813a18eb48'
) from pg_catalog.pg_proc
where oid='public.save_persona(uuid,text,text,text[],jsonb,text[])'::regprocedure;
