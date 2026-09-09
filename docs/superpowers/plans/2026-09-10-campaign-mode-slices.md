# Campaign Mode — vertical-slice plan (for sign-off, nothing built)

**Written:** 2026-09-10 · **Spec:** `docs/research/2026-09-09-embalio-campaign-mode-prompt.md`
(the plan it operationalises: `2026-09-09-mycel-colonization-log.html`) · **Status:** plan only.
The prompt asks for sign-off on the slice order before code; this is that ask.

## Two decisions the prompt asks to settle before writing code

1. **Auth first.** Slices 4–5 store contributor wallets and operator identities; they do
   not ship behind a no-auth app. Slice 1 stores only public on-chain data and can ship
   either way, but the simplest sequencing is: land the auth merge (runbook in
   `docs/runbooks/2026-09-10-auth-merge-runbook.md`), then start slice 1.
2. **Campaign replies vs. the GATE-2 dataset.** Same primitive (`sniper_alerts`,
   `source='manual'`), different question. Proposal: add `campaign_id uuid null` to
   `sniper_alerts`; `/performance/gate-2` filters `campaign_id is null` by default and
   accepts `?campaign=<id>`; `computeScorecard` is unchanged (it is already pure over
   rows). GATE-2's history stays exactly as it is; campaign replies never leak into it.
   This is also what the GATE-2 close-out recommendation in `docs/GOAL-LOG.md` assumes.

## Slice order (proposed)

| # | Slice | Why this position | Moves a number? |
|---|---|---|---|
| 1 | **Campaign row + daily on-chain snapshot + ladder view** | Your prior, and correct: nothing else is worth opening without a live SOL/day. Public data only; no auth dependency. | Shows the number. Moves nothing. |
| 2 | **Track B logging: `campaign_id` + `archetype` + `operator` on the manual-sniper flow; saved searches with `&f=live`; block counters + streak on the home plan card** | The daily work the plan says will move the number, logged where the number is. Reuses `ManualSniperForm`, `createManualAlert`, `DailyPlanCard`. Needs auth in prod (operators are named, but see the roster note). | The only slice that can move the product leg of GATE-3. |
| 3 | **Track C ledger: bounties, contributors, payouts; Ledger/Receipt post generator; anti-farm rules as DB constraints + a `reviewed_by` gate before `paid`** | The engine per the plan ("Track B buys contributors; contributors buy volume"). Needs auth (wallets). Payouts are manual on-chain for now; the app records and generates the posts. | Moves the campaign leg's *leading* indicator (contributors holding). |
| 4 | **Track A checklist with evidence → public diligence page** at `/c/[slug]` (outside `(app)`, no auth, read-only) | One-time work the owner does by hand this week anyway; the app's value is that the checklist *is* the public page. Cheap. Placed after 2–3 because the owner will have done A1–A4 by hand before this ships. | No. Trust, not volume. |
| 5 | **Operator roster + coordination guardrails** (2nd operator on same target → warn; 3rd → block; near-duplicate reply text across operators; megaphone budget 1/week) | Depends on slice 2's operator dimension. Must exist **before more than one operator logs replies through the app**. Not cut — the prompt's note is right that a suspension is unrecoverable. | Protects the accounts that move the number. |

If you want 5 earlier: fold the *warn on 2nd / block on 3rd* rule into slice 2 (it is a
count over `sniper_alerts` by target tweet id; ~30 lines) and leave the duplicate-text check
and the megaphone budget for 5. Recommended.

**Roster note (needs your call):** the five operators are X accounts, some run by allies.
Giving allies Embalio logins means multi-user tenancy (the O6 `FIXED_PROFILE_ID` tension in
the goal log). Proposal for v1: **operators are labels, not users** — the owner logs every
reply and picks the operator from a dropdown. Guardrails work on the label. Multi-user waits
until an ally actually asks for the app.

## Slice 1 in detail (the one to start)

**Schema** — `supabase/migrations/2026MMDD_campaigns.sql` (written, not applied; hand you the SQL):

- `campaigns` — `id`, `profile_id` (FK), `slug`, `name`, `x_handle`, `chain` (`'solana'`),
  `mint`, `pair_address`, `dex_id`, `fee_bps_community` (int; MYCEL ≈ 100), `treasury_wallet`
  (null until published), `ladder jsonb` (`[{day:30, vol_usd:15000, sol_per_day:1.5,
  contributors:10}, …]`), `started_at`, `created_at`. RLS on, owner policy via `profiles`.
- `campaign_snapshots` — `campaign_id`, `day date`, `price_usd`, `price_native`, `fdv`,
  `market_cap`, `liquidity_usd`, `vol_h24/h6/h1`, `txns_h24_buys/sells`,
  `price_change_h24`, `holder_accounts`, `holder_accounts_nonempty`, `sol_usd` (derived:
  `price_usd / price_native` — DexScreener gives both, no extra API), `sol_per_day`
  (`vol_h24 × fee_bps/10000 / sol_usd`), `avg_trade_usd`, `raw jsonb`, `captured_at`;
  `unique (campaign_id, day)`. RLS on, service-role only (same posture as `analytics_daily`).

**Ingest** — `src/lib/campaign/dexscreener.ts` (fetch + zod parse of
`/latest/dex/tokens/<mint>`; pick the pair by `pair_address`, else highest liquidity),
`src/lib/campaign/helius.ts` (`getTokenAccounts` paginated at limit 1000 until `total`
exhausted; count all and non-zero; **never** `getTokenHolders`), `src/lib/campaign/derive.ts`
(pure: `sol_per_day`, `avg_trade_usd`), `src/app/api/cron/campaign-snapshot/route.ts`
(`cronAuthError`, GET-only, one upsert per campaign), `.github/workflows/campaign-snapshot.yml`
(daily 00:10 UTC, curl with `CRON_SECRET`, same shape as `signal-retention`). Env:
`HELIUS_API_KEY`.

**Ladder** — `src/lib/campaign/ladder.ts` (pure): `rungFor(day)`, `actualVsTarget`,
`killRules(snapshots, contributors)` returning the four alerts from the plan with the
evidence that fired them. **View** — `/performance/campaign/[slug]`: today's vitals
(SOL/day, volume, trades, avg trade, non-empty holders), the ladder table
(Today/30/60/90 target vs actual), kill-rule banners, a 30-day sparkline. Home card gets
one line: "MYCEL · 0.7 SOL/day · day 14 of 90".

**Tests** — parsers against recorded DexScreener/Helius fixtures; derive + ladder + kill
rules as pure tables; route test for cron auth (copy `signal-retention/route.test.ts`).

**Verification against prod** — after the migration is applied and the workflow
dispatched once: snapshot row for today, page renders the same volume DexScreener shows.

**Honest expectation:** slice 1 moves no number. It makes the number visible daily, which
is the precondition the plan (and you) put first.

## Things I would not build

- Automatic payouts, on-chain writes, or anything holding a key. The app records; the
  wallet is yours.
- A second reply-logging path. Everything goes through `createManualAlert`.
- Anything Apify. Snapshots come from DexScreener + Helius only.

## Sizing

Slice 1 ≈ one session (migration + two clients + cron + one page + tests). Slice 2 ≈ one
session. Slice 3 ≈ two. Slices 4–5 ≈ one each. Order 1 → 2 → 3 → 4 → 5 with the 2nd/3rd-
operator rule pulled into 2.

**Sign-off needed on:** the order · `campaign_id` on `sniper_alerts` as the GATE-2
separation · operators-as-labels for v1 · auth before slice 2.
