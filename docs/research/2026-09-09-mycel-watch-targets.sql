-- Seed watch_targets for the $MYCEL / @organic_mycel growth push.
-- Companion to docs/research/2026-09-09-mycel-x-growth-playbook.md (§4).
--
-- NOT a migration. Run by hand against the target project, after verifying the
-- handles are live (see the playbook's §4a caveat — the list was assembled from
-- research, not from a live X check).
--
-- Semantics that matter:
--   * priority is ordered DESC (src/server/sniper.ts:128) — higher = polled first.
--   * only the top 10 ACTIVE handles are ever used (MAX_WATCH_HANDLES = 10,
--     src/server/sniper.ts:25 / src/lib/sniper/watch.ts:1). Everything below the
--     top 10 is seeded with active = false so it is parked, not silently dropped.
--   * sniper polling is currently paused (Apify off), so this list serves the
--     manual-sniper loop and the X Lists in the playbook. Rotate what's active
--     as the account grows and the 2-10x sizing band moves.
--
-- Profile: single-tenant today, so the profile is resolved by taking the oldest
-- row. Replace the subselect with an explicit id if more than one profile exists.

begin;

with target_profile as (
  select id from public.profiles order by created_at limit 1
),
seed(handle, priority, active, tier) as (
  values
    -- L1 STRIKE — active set. Trenches infra + mid-tier CT: reply sections are
    -- full of the exact buyer, and the accounts sit in the 2-10x band.
    ('axiom_exchange',  100, true,  'L1 strike'),
    ('bullx_io',         98, true,  'L1 strike'),
    ('photonsol',        96, true,  'L1 strike'),
    ('gmgnai',           94, true,  'L1 strike'),
    ('tradewithNova',    92, true,  'L1 strike'),
    ('bagsapp',          90, true,  'L1 strike'),
    ('TeddyxROO',        88, true,  'L1 strike'),
    ('SolanaDali',       86, true,  'L1 strike'),
    ('nftkeano',         84, true,  'L1 strike'),
    ('boogiepnl',        82, true,  'L1 strike'),

    -- L1 bench — rotate into the active 10 as targets are proven or dropped.
    ('bloom_trading',    80, false, 'L1 bench'),
    ('moonshot',         78, false, 'L1 bench'),
    ('believeapp',       76, false, 'L1 bench'),
    ('awkchan45',        74, false, 'L1 bench'),
    ('s1mple_s1mple',    72, false, 'L1 bench'),

    -- L3 GIANTS — reply only with something genuinely additive. Low hit rate,
    -- high payoff. Parked: they are far outside the 2-10x band today.
    ('solana',           60, false, 'L3 giant'),
    ('aeyakovenko',      58, false, 'L3 giant'),
    ('rajgokal',         56, false, 'L3 giant'),
    ('JupiterExchange',  54, false, 'L3 giant'),
    ('RaydiumProtocol',  52, false, 'L3 giant'),
    ('heliuslabs',       50, false, 'L3 giant'),
    ('phantom',          48, false, 'L3 giant'),
    ('solflare',         46, false, 'L3 giant'),
    ('dexscreener',      44, false, 'L3 giant'),
    ('birdeye_so',       42, false, 'L3 giant'),
    ('solscanio',        40, false, 'L3 giant'),
    ('pumpdotfun',       38, false, 'L3 giant'),
    ('LetsBonk_fun',     36, false, 'L3 giant'),
    ('bonk_inu',         34, false, 'L3 giant'),
    ('CryptoCobain',     32, false, 'L3 giant'),
    ('cobie',            30, false, 'L3 giant'),

    -- L4 WATCHTOWER — source material for original posts. Do NOT reply here;
    -- parked so they never consume a polling slot.
    ('SolanaFloor',      20, false, 'L4 watchtower'),
    ('solanalegend',     18, false, 'L4 watchtower'),
    ('0xMert_',          16, false, 'L4 watchtower'),
    ('blknoiz06',        14, false, 'L4 watchtower'),
    ('notthreadguy',     12, false, 'L4 watchtower'),
    ('theunipcs',        10, false, 'L4 watchtower')

    -- L2 PEERS is deliberately absent: it must be built weekly from DexScreener
    -- (Solana, $30k-$500k mcap, <60d old, sorted by 24h txns) plus the 2-3
    -- loudest repliers under each. See playbook §4a/§4b.
)
insert into public.watch_targets (profile_id, handle, priority, active)
select tp.id, s.handle, s.priority, s.active
from seed s
cross join target_profile tp
-- watch_targets has no unique (profile_id, handle) constraint (see
-- 20260613_sniper.sql), so ON CONFLICT would never fire. Guard explicitly to
-- keep this file re-runnable without duplicating rows.
where not exists (
  select 1 from public.watch_targets w
  where w.profile_id = tp.id and lower(w.handle) = lower(s.handle)
);

commit;

-- Sanity check after running:
--   select handle, priority, active from public.watch_targets
--   where active order by priority desc;
-- Expect exactly 10 rows (the L1 strike set).
