-- TEMPORARY CONTAINMENT, owner-run only. Not applied by the agent.
-- Removes anonymous/PUBLIC privileges on the 19 confirmed exposed tables.
-- Does NOT enable RLS, link profiles, or change authenticated/service access.
-- Authenticated access remains broad until the full RLS recovery is complete.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $containment$
declare
  tables text[] := array[
    'profiles','seed_targets','candidates','drafts','posts','posting_accounts',
    'posting_jobs','research_briefings','watch_targets','sniper_alerts','push_subscriptions',
    'signal_tweets','tweet_metric_snapshots','activity_events','topic_history',
    'follower_snapshots','analytics_daily','predictions','strategy_snapshots'
  ];
  t text;
  r text;
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I',t)) is null then
      raise exception 'RLS containment: missing expected table public.%',t;
    end if;
    execute format('lock table public.%I in share row exclusive mode',t);
  end loop;

  foreach t in array tables loop
    execute format('revoke all privileges on table public.%I from public, anon',t);
  end loop;

  -- Check effective privileges after every revoke. Do not silently claim
  -- containment when membership or a different grantor still exposes a table.
  foreach t in array tables loop
    if has_table_privilege('anon',format('public.%I',t),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
       or has_any_column_privilege('anon',format('public.%I',t),'SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception 'RLS containment: anonymous access survives on public.%; review roles/grants',t;
    end if;
    foreach r in array array['authenticated','service_role'] loop
      if not (has_table_privilege(r,format('public.%I',t),'SELECT')
          and has_table_privilege(r,format('public.%I',t),'INSERT')
          and has_table_privilege(r,format('public.%I',t),'UPDATE')
          and has_table_privilege(r,format('public.%I',t),'DELETE')) then
        raise exception 'RLS containment: public.% would lose existing % CRUD; review before proceeding',t,r;
      end if;
    end loop;
  end loop;
end
$containment$;

commit;
