-- GATE-2 ignition seed: in-band (2.6k–13k follower) watch targets for @FCisco95.
--
-- WHY: the prior watch_targets were oversized (100k+), so sizeFit collapsed and the
-- sniper fired near-never (Session-12 live-fire returned alerts:0). In-band handles in
-- the 2–10x follower band are the prerequisite for ANY GATE-2 alert. See
-- docs/superpowers/notes/2026-06-23-gate2-ignition-reconciliation.md.
--
-- ✅ FILLED + APPLIED 2026-06-25 to live (project vzxpakxjnuaesfxihyvl) via Supabase MCP.
-- Handles sourced via Grok (live X follower data) for @FCisco95's REAL niche: solo
-- Solana/blockchain dev + build-in-public (corrected from the earlier "vibe-coding"
-- assumption). Owner followers ~1,311 → 2–10x band = 2.6k–13k. 'kaixcreator' added on a
-- proven 65k-view reply (oversized but real out-of-network reach). Follower counts to be
-- verified from the first poll's captured author metrics, then pruned if mis-sized.
--
-- Idempotent: re-running upserts (re-activates + reprioritizes) and is safe.

with prof as (
  -- Owner profile. Adjust the handle if the stored value differs from 'FCisco95'.
  select id from public.profiles where lower(handle) = lower('FCisco95') limit 1
)
insert into public.watch_targets (profile_id, handle, priority, active)
select prof.id, v.handle, v.priority, true
from prof, (values
  -- handle (lowercase, no @),  priority (1–5; higher = polled first)
  ('kaixcreator',                5),  -- proven 65k-view reply (OON reach); poll first
  ('heymike777',                 5),  -- Solana builder, ~2.0x
  ('w3_surfer',                  5),  -- Solana / Rust, ~1.9x
  ('dom_gag_96',                 4),  -- AI / builders, ~5.3x (big reach, looser niche fit)
  ('saadpastadev',               4),  -- build-in-public, ~1.7x
  ('sahilpanhotra',              3)   -- indie / SaaS / AI, ~1.4x
) as v(handle, priority)
on conflict (profile_id, handle) do update
  set active = true, priority = excluded.priority;

-- Retire the oversized seeds so they stop crowding the 15-min poll (maxPerHandle is
-- small). These were the prior active list — all 100k+ / well outside the 2–10x band.
update public.watch_targets wt
set active = false
from public.profiles p
where wt.profile_id = p.id
  and lower(p.handle) = lower('FCisco95')
  and wt.handle in ('thisiskp_', 'arvidkahl', 'tdinh_me', 'florinpop1705');

-- Sanity check (run after): the active list should be the 6 in-band handles only.
--   select handle, priority, active from public.watch_targets
--   where profile_id = (select id from public.profiles where lower(handle)=lower('FCisco95'))
--   order by active desc, priority desc;
