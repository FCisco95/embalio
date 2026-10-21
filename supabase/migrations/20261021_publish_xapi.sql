-- 2026-10 revamp, Day-0 contract (2/5): approve -> schedule -> publish via X API.
-- drafts gain scheduling, the agent's stated angle/rationale, and a link that is
-- posted as reply 1 (never in the main body: the Rank-2 reach rule).
-- posting_jobs gains the 'xapi' method next to the legacy 'adspower' one.
-- posts gain tweet_id (idempotency + metrics matching) and the link reply's URL.
-- Additive + idempotent. Plan: docs/superpowers/plans/2026-10-21-revamp-plan.md (section 2)

alter table public.drafts
  add column if not exists scheduled_at timestamptz,
  add column if not exists angle        text,
  add column if not exists rationale    text,
  add column if not exists link_url     text;

alter table public.drafts drop constraint if exists drafts_status_check;
alter table public.drafts add constraint drafts_status_check
  check (status in ('draft','approved','scheduled','posted','skipped','unconfirmed'));

alter table public.drafts drop constraint if exists drafts_scheduled_needs_time;
alter table public.drafts add constraint drafts_scheduled_needs_time
  check (status <> 'scheduled' or scheduled_at is not null);

create index if not exists drafts_due_idx
  on public.drafts (scheduled_at) where status = 'scheduled';

-- posting_jobs.method was created inline in 0003_posting.sql, so drop whatever
-- check constraint governs it rather than guessing the auto-generated name.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and rel.relname = 'posting_jobs'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%method%'
  loop
    execute format('alter table public.posting_jobs drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.posting_jobs add constraint posting_jobs_method_check
  check (method in ('adspower','xapi'));

alter table public.posting_jobs add column if not exists reply_result_url text;

alter table public.posts
  add column if not exists tweet_id       text,
  add column if not exists link_tweet_url text;

update public.posts
   set tweet_id = substring(tweet_url from '/status/(\d+)')
 where tweet_id is null and tweet_url is not null;

create unique index if not exists posts_profile_tweet_id_uidx
  on public.posts (profile_id, tweet_id) where tweet_id is not null;
