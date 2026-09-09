# Build prompt — Embalio "Campaign Mode"

Paste the block below into a fresh Claude Code session **in the `embalio` repo**.
It is written to be grounded in what already exists, so the agent extends rather
than rebuilds.

Companion plan the feature operationalises:
`docs/research/2026-09-09-mycel-colonization-log.html`

---

```
Read docs/HANDOFF.md, docs/GOAL-LOG.md, AGENTS.md and
docs/research/2026-09-09-mycel-colonization-log.html before planning anything.
The HTML is the growth plan this feature exists to operationalise — treat it as
the product spec, not as background reading.

## Goal

Turn Embalio from "a tool that scores tweets" into "the app that runs a growth
campaign end to end". Today the operator has a plan in an HTML file and a
scoreboard in their head. I want to open the app each morning, see exactly what
to do, do it, and watch one number move.

The first campaign is $MYCEL (Solana, mint
HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg, X @organic_mycel), but build it as
a campaign, not as a MYCEL special case.

## What already exists — reuse, do not rebuild

- `watch_targets` (handle · priority · active) — the target list. Note the hard
  cap: only the top 10 active handles are used (`MAX_WATCH_HANDLES`,
  src/server/sniper.ts:25 and src/lib/sniper/watch.ts:1).
- Manual sniper mode on `/engage` — paste a tweet URL, `parseTweetUrl` +
  `targetScore()` score it, a reply is drafted, and it persists as a
  `sniper_alerts` row with `source='manual'`. This is the reply-logging
  primitive. Extend it; do not write a second one.
- `/performance/gate-2` scorecard, `src/lib/gate/expiry.ts`, precision/skip-reason
  logic. The measurement patterns are already there.
- `src/lib/coach/daily-plan.ts` + `src/server/daily-plan.ts` + the home
  `DailyPlanCard` — the "what to do today" surface. Campaign work belongs here.
- `src/lib/engagement/reach-lint.ts` — advisory composer hints.
- `profiles` is the multi-account row and `?profile=` is already honoured on the
  performance pages.
- Uncommitted in the working tree: an auth layer (src/server/auth.ts,
  auth-actions.ts, fixed-profile.ts, /login, a real src/proxy.ts session gate)
  and two RLS-hardening migrations. Decide early whether to land these first —
  campaign data with contributor wallets in it should not sit behind a no-auth
  app. Check `git status` and read them before choosing.

## What to build

### 1. Campaign + on-chain scoreboard (build this first — nothing else is
### useful without a live number)

A `campaigns` row: name, X handle, chain, mint address, DEX pair address, the
fee rate (MYCEL: ~1 SOL per $10k volume ≈ 1%), and the ladder targets.

A daily ingest job storing a snapshot per campaign per day:
- DexScreener token API (`https://api.dexscreener.com/latest/dex/tokens/<mint>`)
  → priceUsd, fdv, marketCap, liquidity.usd, volume h24/h6/h1, txns h24 buys and
  sells, priceChange h24.
- Helius DAS `getTokenAccounts` for the mint → holder-account count. Do NOT use
  `getTokenHolders`; it silently truncates (it reported 20 holders where the real
  count was 388, and that error changed the strategy).
- Derive and store: SOL/day (volume x fee rate), average trade size
  (volume h24 / txns h24), non-empty holder count.

Follow the existing cron auth pattern (`cronAuthError`, constant-time bearer,
GET-only, fail-closed) — it was verified clean in the 2026-07-23 audit.

Surface it as a ladder view: target vs actual for Today / Day 30 / Day 60 /
Day 90, with the kill rules from the plan firing as visible alerts:
- contributors < 10 by day 30
- SOL/day < 1.0 by day 30
- profile visits < 50/day per operator after 3 weeks
- raid payouts rising while volume is flat

### 2. Track A — the standing checklist, which outputs a public page

A checklist of one-time trust tasks (supply lock, LP lock, DexScreener Enhanced
Token Info, CoinGecko, CMC, Jupiter verification), where **each item stores its
evidence** — a URL, address or tx signature — not just a checkbox.

Then generate the diligence page from that evidence: the six things a serious
buyer screens for, each rendered with its link, at a shareable route. The
checklist and the public page are the same data. That is the point: completing
setup produces the artefact.

### 3. Track B — the daily block runner

The five blocks from the plan (Strike 20 / Relationship 10 / Second strike 20 /
Originals 3+1 / Amplify 1-2), each assigned to a named operator, each with a
counter that resets daily. Show streak, because 7 days/week beats 5 by ~3x and
the streak is the behaviour being bought.

Store the eight saved searches per campaign and render each as a one-click X
search link that **opens the Latest tab, not Top** (`&f=live`) — timing is the
whole strategy and Top defeats it. The queries are in the plan's "search stack"
section; seed them, let the operator edit them.

Logging a reply reuses the manual-sniper flow and additionally captures which
archetype (A-01…A-09) it was, so we can eventually report conversion per
archetype. Archetype definitions and their example lines live in the plan.

### 4. Operator roster + coordination guardrails (do not skip this)

Multiple X accounts per campaign with roles (coin / platform / dev / megaphone /
grinder). X treats coordinated multi-account activity as platform manipulation
and the March-April 2026 enforcement wave caught legitimate accounts, so the app
must actively protect the operator:
- warn when a second operator logs a reply to the same target post,
- block or hard-warn on a third,
- flag near-duplicate reply text across operators before it is sent,
- surface a "megaphone budget" for the 50k account (1 mention/week max).

These are product features, not policy text. The app should make the safe
pattern the easy one.

### 5. Track C — contributor ledger

Bounties (description, price in MYCEL, status), contributors (X handle, wallet,
hold-gate status, weekly earnings, cap remaining), and payouts (amount, tx
signature, date). From this, generate draft Ledger and Receipt posts — including
when the routed number is zero, which the plan deliberately wants published.

Encode the anti-farm rules as constraints, not documentation: no scoring weight
for likes, weight by target account size, earning requires the hold gate, a hard
weekly cap per wallet, score decay, and a manual review step before any payout is
marked paid.

## Constraints

- Follow AGENTS.md: this Next.js is not the one you remember. Read the relevant
  guide in node_modules/next/dist/docs/ before writing any code.
- TDD, matching the existing suite's style. It is currently 791 pass / 1 skip —
  keep it green, and keep tsc and `npm run build` green throughout.
- Trunk policy is direct-to-main, suite-green-gated.
- Do not break `/performance/gate-2` or the GATE-2 dataset. Campaign replies are
  the same primitive as sniper replies; if that creates ambiguity in the
  scorecard, say so before writing code rather than after.
- No Apify, no paid polling. Everything here is manual-entry plus free public
  APIs (DexScreener, Helius).
- Migrations: write them, but do not apply to prod yourself — surface the SQL and
  let me apply it.

## How to work

Plan before building. Propose a vertical-slice order and get sign-off on it —
my strong prior is that slice 1 is "campaign row + daily on-chain snapshot +
ladder view", because a live SOL/day number is the only thing that makes the
rest worth opening. Do not build all five areas in one pass.

For each slice: tests first, then implementation, then verify against the real
prod deployment, then a conventional commit. Report what actually moved on the
ladder, and say plainly when a change moved nothing — the GOAL-LOG convention of
"this moved no number, and here is why none could" is the standard I want kept.
```

---

## Notes for whoever runs this

- The prompt deliberately front-loads the on-chain scoreboard. Everything else is
  a checklist app until there is a live number to move.
- The `getTokenHolders` warning is load-bearing — that truncation produced a
  wrong strategic read once already.
- The coordination guardrails (section 4) are the part most likely to get cut for
  scope. Don't: the 50k-follower ally is the campaign's most valuable and most
  exposed asset, and a suspension is unrecoverable.
