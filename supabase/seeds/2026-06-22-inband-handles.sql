-- GATE-2 ignition seed: in-band (2.6k–13k follower) watch targets for @FCisco95.
--
-- WHY: the current watch_targets are oversized (100k+), so sizeFit collapses and the
-- sniper fires near-never (Session-12 live-fire returned alerts:0). In-band handles in
-- the 2–10x follower band are the prerequisite for ANY GATE-2 alert. See
-- docs/superpowers/notes/2026-06-23-gate2-ignition-reconciliation.md.
--
-- ⚠️ THIS IS A TEMPLATE — the PLACEHOLDER handles below are NOT real. Before running:
--   1. Use the x-target-finder skill to find 4–6 real handles in the 2.6k–13k band for
--      @FCisco95's niche (vibe-coding / solo-dev / building on blockchain).
--   2. Replace the PLACEHOLDER_* rows with those handles (lowercase, no leading @).
--   3. Confirm the oversized-retire list at the bottom matches your CURRENT watch list.
--   4. Run once (Supabase SQL editor, or: psql "$DATABASE_URL" -f <this file>).
--
-- Idempotent: re-running upserts (re-activates + reprioritizes) and is safe.

with prof as (
  -- Owner profile. Adjust the handle if the stored value differs from 'FCisco95'.
  select id from public.profiles where lower(handle) = lower('FCisco95') limit 1
)
insert into public.watch_targets (profile_id, handle, priority, active)
select prof.id, v.handle, v.priority, true
from prof, (values
  -- handle (lowercase, no @),          priority (1–5; higher = polled first)
  ('placeholder_inband_1',              5),
  ('placeholder_inband_2',              5),
  ('placeholder_inband_3',              4),
  ('placeholder_inband_4',              4),
  ('placeholder_inband_5',              3)
) as v(handle, priority)
on conflict (profile_id, handle) do update
  set active = true, priority = excluded.priority;

-- Retire the oversized seeds so they stop crowding the 15-min poll (maxPerHandle is
-- small). 'arvidkahl' (~200k = ~155x) is the documented offender; add any others your
-- current list contains. Verify before running so you don't deactivate a valid target.
update public.watch_targets wt
set active = false
from public.profiles p
where wt.profile_id = p.id
  and lower(p.handle) = lower('FCisco95')
  and wt.handle in ('arvidkahl');  -- TODO: append your other 100k+ handles here

-- Sanity check (run after): the active list should be your 4–6 in-band handles only.
--   select handle, priority, active from public.watch_targets
--   where profile_id = (select id from public.profiles where lower(handle)=lower('FCisco95'))
--   order by active desc, priority desc;
