-- GATE-2 precision honesty: a dismissal that was never actually judged (e.g. a
-- bulk cleanup of alerts that sat unread) is not a false alert. It needs its own
-- label so it can be excluded from the precision denominator.
--
-- Additive + idempotent. NOT YET APPLIED TO PROD as of 2026-08-02 — no runtime
-- path writes 'not_reviewed' yet, so shipping the read side ahead of this is
-- safe. Apply before any bulk cleanup uses the new value.
-- Decision record: docs/superpowers/plans/2026-08-02-precision-metric-definition.md

-- The original constraint was created inline by `add column ... check (...)`
-- (20260626_sniper_scorecard.sql), so its name was auto-generated. Drop whatever
-- check constraint currently governs skip_reason rather than guessing the name —
-- a missed drop would leave the old constraint in force and silently reject the
-- new value.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'sniper_alerts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%skip_reason%'
  loop
    execute format('alter table public.sniper_alerts drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.sniper_alerts
  add constraint sniper_alerts_skip_reason_check
  check (
    skip_reason is null
    or skip_reason in ('off_niche', 'stale', 'bait', 'wrong_size', 'other', 'not_reviewed')
  );
