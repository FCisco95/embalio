-- 2026-10 revamp, Day-0 contract (3/5): exclusive target allocation.
-- X prohibits several accounts engaging the same content. With 3-5 managed
-- accounts in overlapping niches, "one target post -> at most ONE managed
-- account" must be impossible to violate, not a warning. The trigger claims the
-- post for the first profile that writes it and rejects any other profile.
-- Writers pre-claim through src/lib/targets/allocation.ts so a batch upsert never
-- aborts on one taken row. Plan: docs/superpowers/plans/2026-10-21-revamp-plan.md (section 4)

create table if not exists public.target_allocations (
  source_tweet_id text primary key,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  allocated_by    text not null default 'agent' check (allocated_by in ('agent','sniper','manual')),
  allocated_at    timestamptz not null default now()
);

create index if not exists target_allocations_profile_idx
  on public.target_allocations (profile_id, allocated_at desc);

alter table public.target_allocations enable row level security;
revoke all privileges on table public.target_allocations from anon, authenticated;

create or replace function public.enforce_target_allocation() returns trigger
language plpgsql as $$
declare owner uuid;
begin
  insert into public.target_allocations (source_tweet_id, profile_id, allocated_by)
  values (new.source_tweet_id, new.profile_id, tg_argv[0])
  on conflict (source_tweet_id) do nothing;

  select profile_id into owner
    from public.target_allocations
   where source_tweet_id = new.source_tweet_id;

  if owner <> new.profile_id then
    raise exception 'target % is allocated to another profile', new.source_tweet_id
      using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists candidates_target_alloc on public.candidates;
create trigger candidates_target_alloc
  before insert on public.candidates
  for each row execute function public.enforce_target_allocation('agent');

drop trigger if exists sniper_alerts_target_alloc on public.sniper_alerts;
create trigger sniper_alerts_target_alloc
  before insert on public.sniper_alerts
  for each row execute function public.enforce_target_allocation('sniper');

-- Backfill: the earliest existing candidate row wins each tweet.
insert into public.target_allocations (source_tweet_id, profile_id, allocated_by)
select distinct on (source_tweet_id) source_tweet_id, profile_id, 'agent'
  from public.candidates
 order by source_tweet_id, pulled_at
on conflict do nothing;
