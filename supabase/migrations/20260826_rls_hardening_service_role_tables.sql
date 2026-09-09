-- Harden public tables that are intended to be service-role driven today.
-- This closes the direct Data API exposure on the current RLS-off set without
-- breaking the current single-tenant no-auth app path. The remaining
-- historically RLS-off profile-linked tables are hardened in the paired
-- 20260826_rls_hardening_deferred_profile_tables.sql migration after their app
-- reads/writes were moved to service-role code paths.

alter table public.signal_tweets enable row level security;
alter table public.tweet_metric_snapshots enable row level security;
alter table public.watch_targets enable row level security;
alter table public.sniper_alerts enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all privileges on table public.signal_tweets from anon, authenticated;
revoke all privileges on table public.tweet_metric_snapshots from anon, authenticated;
revoke all privileges on table public.watch_targets from anon, authenticated;
revoke all privileges on table public.sniper_alerts from anon, authenticated;
revoke all privileges on table public.push_subscriptions from anon, authenticated;

grant select, insert, update, delete on table public.watch_targets to authenticated;
grant select, insert, update, delete on table public.sniper_alerts to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

drop policy if exists "watch_targets owner select" on public.watch_targets;
create policy "watch_targets owner select"
on public.watch_targets
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = watch_targets.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "watch_targets owner insert" on public.watch_targets;
create policy "watch_targets owner insert"
on public.watch_targets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = watch_targets.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "watch_targets owner update" on public.watch_targets;
create policy "watch_targets owner update"
on public.watch_targets
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = watch_targets.profile_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = watch_targets.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "watch_targets owner delete" on public.watch_targets;
create policy "watch_targets owner delete"
on public.watch_targets
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = watch_targets.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "sniper_alerts owner select" on public.sniper_alerts;
create policy "sniper_alerts owner select"
on public.sniper_alerts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = sniper_alerts.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "sniper_alerts owner insert" on public.sniper_alerts;
create policy "sniper_alerts owner insert"
on public.sniper_alerts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = sniper_alerts.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "sniper_alerts owner update" on public.sniper_alerts;
create policy "sniper_alerts owner update"
on public.sniper_alerts
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = sniper_alerts.profile_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = sniper_alerts.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "sniper_alerts owner delete" on public.sniper_alerts;
create policy "sniper_alerts owner delete"
on public.sniper_alerts
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = sniper_alerts.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "push_subscriptions owner select" on public.push_subscriptions;
create policy "push_subscriptions owner select"
on public.push_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = push_subscriptions.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "push_subscriptions owner insert" on public.push_subscriptions;
create policy "push_subscriptions owner insert"
on public.push_subscriptions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = push_subscriptions.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "push_subscriptions owner update" on public.push_subscriptions;
create policy "push_subscriptions owner update"
on public.push_subscriptions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = push_subscriptions.profile_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = push_subscriptions.profile_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "push_subscriptions owner delete" on public.push_subscriptions;
create policy "push_subscriptions owner delete"
on public.push_subscriptions
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = push_subscriptions.profile_id
      and p.user_id = (select auth.uid())
  )
);
