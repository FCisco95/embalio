-- Manual sniper mode: distinguish cron-discovered alerts from owner-pasted ones.
-- 'poll'   = discovered by the sniper-poll cron (Apify signal source).
-- 'manual' = owner pasted a tweet URL on /engage (zero Apify; GATE-2 data
--            keeps accruing while polling is off).
-- Additive + idempotent; default backfills all existing rows as 'poll'.
alter table public.sniper_alerts
  add column if not exists source text not null default 'poll';
alter table public.sniper_alerts
  drop constraint if exists sniper_alerts_source_check;
alter table public.sniper_alerts
  add constraint sniper_alerts_source_check check (source in ('poll','manual'));
