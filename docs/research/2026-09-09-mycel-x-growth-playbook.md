# $MYCEL — X growth brief (v2)

**Written:** 2026-09-09 · **Account:** [@organic_mycel](https://x.com/organic_mycel) ·
**Token:** `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg` (Solana) ·
**Platform:** Organic (on-chain fee rail)

**The full playbook is `2026-09-09-mycel-colonization-log.html`** in this folder —
open it in a browser. It carries the phase-by-phase plan, the daily cadence, the
five-account roster protocol, the nine engagement archetypes with example replies,
the raid-bot scoring design, and the measurement table.

This file is the short brief: what changed, what was wrong in v1, and the
decisions that follow. Companion seed file for Embalio's `watch_targets`:
`2026-09-09-mycel-watch-targets.sql`.

---

## Two corrections to v1 (both changed the strategy)

**1. Holders: 388, not 20.** Helius DAS `getTokenHolders` returned a truncated
set. The real figure came from `getTokenAccounts` — **388 token accounts** (some
emptied by sells, which makes them a lapsed list rather than a dead one).

**2. This was never a cold start.** Day one did roughly **$500k volume**. v1
diagnosed "never had interest"; the truth is a launch spike that decayed ~99% to
$6.8k/24h. That is a **re-ignition problem with a warm audience**, which is a far
better position than a cold start and calls for different first moves.

**3. There is a budget.** v1 was written as a zero-budget plan. It isn't one —
and the budget is best spent *through the fee rail*, which is the thing the
project exists to prove.

---

## Baseline (live, 2026-09-09)

| Metric | Value | Source |
|---|---|---|
| Market cap / FDV | $49,847 | DexScreener |
| Liquidity | $20,820 | DexScreener (Raydium `5pk8k3e…k1UZ`) |
| Volume 24h | $6,785 — **down from ~$500k on day 1** | DexScreener / operator |
| Transactions 24h | 134 (67 buys / 67 sells) | DexScreener |
| Price change 24h | −11.3% | DexScreener |
| Token accounts | **388** | Helius `getTokenAccounts` |
| Supply | 999,850,024 — fixed, mint + freeze revoked, immutable | Helius DAS |
| To community treasury | ~1% of volume, held in SOL (≈1 SOL per $10k) | Internal |
| Treasury seed | ~10 SOL — wallet not yet created | Internal |
| Treasury inflow | ~0.7 SOL/day ≈ **~5 SOL/week** at current volume | Derived |
| Founder supply locked | **10%, two years** — currently unpublicised | Operator |

Internal figures are approximations that reconcile with the volume history, so
they're good enough to plan against. Swap in exact numbers once the treasury
wallet is live; the plan's shape won't change.

**Not true yet:** the treasury wallet does not exist and nothing has routed.
Until both are real and public, the fee-rail claim is an intention and must be
described that way — "what we're setting up", not "what happens".

---

## Targets (the ask: "tell me what's right")

North star is **SOL per day**, not followers and not price.

| Horizon | Volume/day | Trades/day | SOL/day | SOL/month | What must be true |
|---|---|---|---|---|---|
| Today | $6.8k | 134 | 0.7 | ~20 | Nothing changes |
| Day 30 | $15k | ~295 | 1.5 | ~45 | First payouts landed · ~10 contributors holding · 388 wallets worked by hand |
| Day 60 | $30k | ~590 | 3 | ~90 | Raid bot live · ~30 contributors · deeper pool |
| Day 90 | $50k | ~980 | 5 | ~150 | ~60 contributors · recurring traders · scanner surfaces |

Two facts that set these: **average trade is ~$51** ($6,785 ÷ 134), so volume
grows through trade *count*; and **liquidity is the ceiling** — at a $20.8k pool
a $1,000 buy is ~5% of the pool and prices like it.

**The honest limit:** replies do not buy volume directly. Converting reach to
trades at the rates a small account gets would need tens of thousands of profile
visits/day to add a few hundred trades. **Replies buy the narrative and the
contributors; the contributors buy the volume.** That's why the raid bot isn't an
add-on — gating payouts on holding makes every contributor a buy, a holder and a
recurring trader, funded by the volume they create.

## Spending the SOL

**~$1k already went to boosts / DexScreener placement, and the result of that
spend is the Phase 01 baseline** — 388 accounts, $6.8k/day, decaying. That's not
a wasted $1k, it's the cleanest evidence you'll get about the channel: it buys
impressions on a surface populated mostly by bots and snipers, and those trades
stop when the budget stops.

**Get the attribution before spending more.** You know the boost dates;
DexScreener keeps the volume history. At a 1% take, **$1k of spend needs $100k of
induced volume just to break even on fees.** Measurable, not a matter of opinion.

**Rule for every future SOL: buy things that keep working after the money stops.**

| Spend | Buys | Keeps working? | Verdict |
|---|---|---|---|
| Contributor payouts through the rail | A holder + poster + trader per person (earning requires holding) | **Yes** | Largest allocation; also the product demo |
| Liquidity | Headroom on trade size | Yes, while it stays in | Second. An asset, with LP risk |
| Durable work products (artist, editor, the raid bot) | Output that outlives the invoice | **Yes** | Third |
| Boosts / trending | Bot + sniper impressions | No | Only to amplify a real event |
| Follow/RT giveaways, airdrops | Farmers who never trade; degrades your follower graph | No — harmful | **Don't.** The usual way "giving SOL away" goes wrong |
| Paid KOL posts at this cap | One post, often sold into | No | Bounties recruit better |

**The benchmark that settles any future spend: ~$100 per durable holder** — a
contributor who holds, posts and trades. Anything that can't plausibly beat that
is worse than routing the same SOL through the rail.

**Where boosts still make sense:** subordinate to events, never standalone. Behind
a first-payout post, a receipt, or the lock announcement, a boost amplifies
something true and lands people on a reason to stay.

**The budget is the flow, not the stock.** The treasury holds ~10 SOL of seed
capital; ~5 SOL/week arrives at current volume, and that scales with the ladder
(~10/wk at day 30, ~21/wk at day 60, ~35/wk at day 90). So the crew starts small
and grows as the volume it creates grows — the only funding model that doesn't
run out.

Split the inflow: **most → contributor payouts** · **a standing reserve →
liquidity** (raises the volume ceiling; capital at risk in LP) · **a small slice →
event amplification**, spent only behind a receipt.

---

## The five decisions

**1. The KPI is volume, not market cap.** Fee income is a function of trades, not
price. Volume comes from *traders* (who never join
a Telegram group); price support comes from *holders*. Two audiences, two content
tracks — most memecoin marketing collapses them and reaches neither.

**1b. Publish the two-year lock.** 10% of your supply locked for two years and
nobody knows. "The dev will dump" is the first objection every stranger has about
a $50k coin, and you have a verifiable on-chain answer you aren't publishing. Bio,
pinned post, and every A-03 reply — beside the revoked mint/freeze authorities.
**It needs a public address or tx**: a lock nobody can check is worth nothing.

**2. The first fee payout is the highest-value action available.** The site
currently says fees route to workers and *nothing has routed yet*. That's an
unfired gun. "First person ever paid by a coin for working on it — tx link"
travels outside the community, converts the claim into a receipt, and recruits
contributors in the replies. Do it before starting the daily grind — every
engagement archetype is built around having a receipt to point at.

**3. Cadence: ~50 replies/day across the roster, not 200.** High-volume,
low-quality replying is the signature X's inauthentic-behavior enforcement
targets; the March–April 2026 wave caught legitimate accounts too. Benchmark is
~15 thoughtful replies beating ~30 generic, and 7 days/week beating 5 by ~3×.
Scale by adding paid operators (that's what the raid bot is for), not by pushing
one person harder.

**4. The five-account roster is the biggest asset — and the main risk.** Coin account / Organic platform / dev account / 50k ally / high-activity
ally. Hard rules: never more than two accounts under one post, never
near-identical text across accounts, stagger timing, no scheduled reciprocal
like-rings, keep accounts on their own people and devices. The 50k ally is the
crown jewel: one mention a week, maximum, and it must read as a person with an
opinion, not a promoter.

**5. Token gate on hold *duration*, not balance.** Solana meme hold times average
seconds. A balance check at join is meaningless — people buy in, join, sell,
stay. Minimum balance held for a minimum number of days, re-verified
continuously, removal on sell. That is the mechanism that actually buys hold
time. The raid bot then gates *earning* on the same check, which prices sybil
identities above what they can earn.

---

## Three questions with hard answers

**1. "Is every coin pumping because of insiders?"** Partly — and less than it
looks. Deployer-funded same-block sniping is a normalised playbook run thousands
of times a week; bundled launches where insiders take a majority of supply and
sell six figures within hours are routinely documented. **But no credible public
figure exists** for what share of launch buying is insider or automated — on-chain
data can't separate a sniper from an insider from a configured retail bot, so
treat quoted percentages as unfounded. **The bigger distortion is survivorship:**
scanners sort by gainers and the algorithm shows you what's moving, so the feed is
a minute-by-minute highlight reel of the top 0.1%. You can't out-manufacture the
manufactured coins. The available position is being visibly *not* that, with
trivially checkable evidence — which the buyers with real size are actively
screening for.

**2. "Can I market-make my own coin, since I get the fees back?"** **No — the
arithmetic kills it before the law does.** You receive ~1% of volume; to generate
that volume you pay the pool's fee on every swap. At best you get back what you
just paid, minus the LP share, minus priority fees, minus what real traders take
off you. **Guaranteed net loss, no upside case.** Projects do it anyway for
perception — which is exactly the conduct DOJ and SEC charged multiple "market
making" firms with in 2024–2026, including an FBI operation running its own token
to catch manipulation-as-a-service. Firms fined, individuals sentenced. And on
your facts it's self-defeating a third way: **wash patterns are what Jupiter
verification and every serious buyer screen for.** You'd be paying to acquire the
signature that disqualifies you.

**3. "What do market makers actually do, then?"** Quote both sides, tighten the
spread, deepen the book so size can move without wrecking price. Deepening
liquidity isn't manipulation anywhere — the illegality is entirely in trading with
yourself to fake activity. At $50k cap no reputable MM will engage; the ones that
will are the manipulation kind. **The legitimate version available to you is being
an LP in your own pool** — earn fees from real flow, raise the volume ceiling.
That's the ~20 SOL line, and its cost is real: impermanent loss and locked capital.

## Standing: the verification stack

- **Jupiter verification (green check).** Marks you canonical wherever Jupiter
  routes. Criteria: **social support** — "Smart Followers" + organic engagement on
  an X account *dedicated to the project* (not personal/KOL) — plus ticker
  uniqueness, on-chain liquidity (locked liquidity counts), revoked mint + freeze.
  **You already pass the authority test; social proof is the gate — and that's
  exactly what the reply grind buys.** Check ticker collisions first (other
  Mycel-named projects exist; duplicates are a top rejection reason).
- **Lock the LP** if it isn't. Counts for Jupiter, kills the second-biggest
  objection. Publish it with the supply lock.
- **DexScreener Enhanced Token Info** — from $299, <15 min. Puts description and
  socials on the page every trader lands on. Check whether the $1k already covered
  this.
- **CoinGecko + CMC** — free, slow. File now; DexScreener pulls from external
  lists including CoinGecko.

**The diligence page nobody at your cap writes.** Serious buyers screen for six
things: supply concentration, deployer dump risk, LP lock, real volume,
accountability, product. You can answer all six with links — revoked authorities,
two-year supply lock, LP lock, doxxed founder, shipping product, auditable rail.
One pinned page, an afternoon's work, and it's what you point at in every A-03
reply.

## Events (Phase 05 — "Flush")

**A calendar beats a launch.** One brilliant event = a spike and a worse chart;
the same event every week = a reason to come back, which is what a holder is.
You're doxxed, you stream, you demo — rare at this cap, and none of it is fakeable
by a bundled coin.

| Event | Cadence | Why |
|---|---|---|
| **Build stream** (ship the raid bot / TG gate on camera) | Weekly, fixed slot | Most defensible thing you own. Nobody fakes 3h of you writing code |
| **The payout stream** (route fees live) | Once, then monthly | Highest-impact single event. This is what the 5 SOL reserve is for |
| **"Who got paid this week"** Space + leaderboard | Weekly, 20 min | People show up for their own name |
| **Bounty office hours** — price and pay live | Weekly/fortnightly | Recruitment disguised as an event |
| **Organic platform demo** | Per release | Sells platform and coin in one motion |
| **Joint Space with peer Organic launches** | Monthly | Reply strategy at 100× scale |
| **Trading competition** | Rarely, structured | Generates volume but attracts mercenaries. Only with a vested/hold-gated prize, funded from fees |

**Don't run:** paid AMAs in signal/ICO Telegram groups (farmers; the event-shaped
version of the boost problem) · giveaway streams · countdown "big reveal" events
(countdowns train people to sell at the top of the countdown).

**Being doxxed is a strategy, not a fact.** Make dated promises small enough that
you always keep them, then keep them in public. Six kept small promises beat one
big announcement.

## Raid bot — rules to fix before the money turns on

Retrofitting anti-farm rules means taking money back from people, which is worse
than never offering it.

- **Never pay for likes.** Pay for replies that earned a reply back, and for
  quote-posts. Cheapest-to-fake actions get zero weight.
- **Weight by target size** — a reply under a 100k post outweighs many under a
  500-follower one, or the farm optimises for dead rooms.
- **Earning requires the hold gate** (see decision 5).
- **Cap weekly payout per wallet** below the cost of maintaining a second
  credible identity. That cap *is* your sybil economics.
- **Decay scores over time** so early contributors can't rent-seek.
- **Human review of top earners before every payout.** Five minutes a week.
- **Publish the leaderboard and the payouts** — the scoreboard is the content.
- **Pay in MYCEL bought on the market, not in SOL.** Every payout becomes a
  trade, and at ~1% you partially refund yourself. Two conditions: pair it with
  vesting or a minimum hold on the paid tokens or you've built a faucet that
  sells into your own pool weekly; and describe the mechanism plainly rather than
  marketing it as a price mechanism — "fees buy the token" has regulatory texture
  in some jurisdictions. Take advice before scaling it.

---

## Run it through Embalio (dogfood)

`watch_targets` (handle · priority · active) is the Strike/Peers list.
Manual sniper mode on `/engage` scores a pasted tweet URL, drafts the reply, pins
it, and tracks whether it was sent and what it earned. `/performance/gate-2`
measures exactly the bet this playbook makes: **do assisted replies move
out-of-network reach?**

Running MYCEL's daily reply blocks through Embalio produces the GATE-2 evidence
that has been blocked on "owner runs the first manual paste" since July. One
activity, two outcomes.

---

## Caveat carried forward

Follower counts and account liveness for the seed handle list were **not**
verified — x.com returns HTTP 402 to automated fetches. Verify every handle
before adding it to a list. Sources for all external claims are in the colophon
of the HTML playbook.
