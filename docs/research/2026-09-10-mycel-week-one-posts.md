# $MYCEL week one — what makes the two trajectory items verifiable, and the posts

**Written:** 2026-09-10 · **Plan:** `2026-09-09-mycel-colonization-log.html` (Track A · A1–A4,
Track C · C1, "In order") · **Accounts:** [@organic_mycel](https://x.com/organic_mycel) (the
network), the founder account (carries the fee-rail argument — the coin account does not).

This repo is public. Nothing here contains an address, key, or amount that is not already
public; every fact that is still yours to supply is a `[[PLACEHOLDER]]`. **Do not post a
draft with a placeholder left in it.** Every draft below is a hook (main post, no link) plus a
reply-1 that carries the links — the posting habit pinned in Session 19.

**Not verified from this side:** this session's container could not reach Solana RPC,
DexScreener or x.com (network policy). The baseline numbers are the 2026-09-09 ones; refresh
them before any post that quotes a number.

---

## 1 · Treasury wallet (A1) — what I need from you so a stranger can verify it

The claim being made in public is: *"~1% of every trade goes into a community treasury,
held in SOL, that pays contributors."* Three parts of that are checkable and one is not
unless you make it so.

| I need | Why | What "verifiable" looks like |
|---|---|---|
| **The treasury address** `[[TREASURY]]` — a fresh keypair used for nothing else | A fresh account whose first activity is the announcement date is itself evidence; an address with prior history invites "that's just your wallet". | Solscan shows creation ≈ announcement day. |
| **A proof-of-control transaction** from `[[TREASURY]]` | Anyone can post an address. Only the key-holder can move from it. | A tiny self-transfer or transfer to the founder wallet **with a memo** — `MYCEL treasury · announced 2026-09-1X` — so the tx is self-describing on Solscan. Post the signature `[[TX_PROOF]]`. |
| **The fee mechanism, exactly** | "Routes automatically" and "I claim creator fees and forward them" are different claims; the second is fine, the first is only true if the program pays the treasury directly. | Either (a) the Organic fee-recipient/creator-vault address is `[[TREASURY]]` itself, or (b) name the claiming wallet `[[FEE_CLAIM_WALLET]]` and the forwarding cadence ("claimed and forwarded every Monday"). Publish whichever is true. |
| **The exact rate** | The plan says "~1%, ≈1 SOL per $10k". Round numbers read as marketing. | The bps from Organic's config `[[FEE_BPS]]` and what share of that is community vs creator/platform (A2 says: shape, not amounts — but the *community* share must be a number if the SOL/day ladder is to mean anything). |
| **The first inbound fee transfer** `[[TX_FIRST_INFLOW]]` | Turns "will route" into "routes". | Solscan link. Until this exists, every post says *setting up*, not *happens*. |

Where it lives once real: bio of @organic_mycel · pinned post · mycelcoin.com · the diligence
page (A6) · Embalio's Track A checklist, which stores each item's evidence (Campaign Mode
slice 2).

## 2 · First fee payment to a contributor (C1) — what I need

| I need | Why |
|---|---|
| The contributor's X handle `[[CONTRIB_HANDLE]]` **with their consent to be named** | The receipt post names them. Ask first; a surprise name-drop reads as a stunt. |
| Their wallet `[[CONTRIB_WALLET]]` | Goes in the tx, not in the post body — the tx link carries it. |
| What the work was, in one line `[[BOUNTY_TEXT]]`, and the price `[[AMOUNT]] [[MYCEL\|SOL]]` | "Paid for work" needs the work to be visible. Link the work if it is a post/clip. |
| **The payment must leave from `[[TREASURY]]`**, not from your personal wallet | Otherwise it is you paying someone, not the coin paying someone. That distinction is the entire claim. |
| A **memo** on the tx: `MYCEL bounty #1 · [[BOUNTY_TEXT_SHORT]]` | Self-describing receipt. |
| The tx signature `[[TX_PAYOUT_1]]` | The post is the link. |
| If paid in MYCEL bought on the market (C6): the buy tx `[[TX_BUY]]` too | Then the receipt shows the loop: SOL in → MYCEL bought → MYCEL paid, which is the C6 mechanism and worth showing once. Pair it with the hold expectation you set for contributors. |

The order the plan wants: **wallet published → proof-of-control → first payout → receipt
post → Ledger post (including zeros) → bounties.** Do not post bounties before the receipt.

## 3 · The lock (A3) — the part that still blocks the post

Settled: **100,000,000 MYCEL, 10.0015% of the 999,850,024 supply, two years.** Not settled:
where it is. I need:

| I need | Why |
|---|---|
| **What holds it**: a locker program (Streamflow, Jupiter Lock, Bonfida, …) `[[LOCK_PROGRAM]]` and the lock/vesting account `[[LOCK_ACCOUNT]]` | "Locked" means a program enforces it. Tokens in a wallet you promise not to touch are **not a lock**, and calling them one is the single fastest way to lose the trust Track A is buying. If it is a promise, publish it as a promise. |
| The creating tx `[[TX_LOCK]]` and the **unlock date** `[[UNLOCK_DATE]]` | The post leads with token count + date, per the plan. |
| A one-click check: Solscan link to the lock account showing the 100,000,000 balance | This is the "wallet balance is a one-click check" argument. |

Session 24 sampled page 1 of the 388 token accounts and saw no ~100M holder — absence of
evidence, not a discrepancy, but it means the lock is not sitting in an ordinary token
account on that page. A locker program's escrow account would be what shows up instead.
`getTokenLargestAccounts` on the mint (top 20 accounts, public RPC, no key) settles it in one
call — this container could not make that call.

---

## Drafts

Voice rules from the plan: the coin account never begs and never explains the joke; the
founder posts real numbers including bad ones; nobody says "revolutionary", "community-driven",
"utility" or "LFG". Each hook is under 280 characters. Links go in reply 1.

### D1 · Treasury address — @organic_mycel (post the day the wallet exists, before anything is in it)

**Hook**
> The MYCEL treasury wallet exists as of today. It is empty. That is the point of posting it now.
>
> Every trade sends a slice here. Every payout leaves from here. You will be able to watch both.
>
> `[[TREASURY]]`

**Reply 1**
> Proof it's ours: `[[TX_PROOF]]` (memo on the tx).
> How the fee split works, in full: `[[LINK_FEE_STRUCTURE_POST]]`
> Balance right now: 0 SOL. Watch it: `https://solscan.io/account/[[TREASURY]]`

### D2 · Founder quote-post of D1 (same day, founder account)

> Posting the address before there's anything in it, on purpose. A treasury you can watch is worth more than one I describe.
>
> Fees start routing `[[WHEN — "this week" / "on the first claim, Monday"]]`. Until then the correct word is "setting up", so that's the word.

### D3 · Fee structure disclosure (A2) — founder account, thread

**Hook**
> How MYCEL trade fees actually split. Structure, not marketing. Writing it down now so nobody has to discover it later.

**Reply 1**
> On every trade, the pool takes a fee. Of that:
> — a **community share** goes to the treasury `[[TREASURY]]`, held in SOL, paid out to people who do work for the coin
> — a **creator/platform share** exists and goes to `[[FEE_CLAIM_WALLET / "the Organic launch rail"]]`
>
> `[[If (b): "Fees are claimed to [[FEE_CLAIM_WALLET]] and forwarded to the treasury every [[DAY]]. Both addresses are public; check the transfers."]]`

**Reply 2**
> Numbers I'll commit to: community share ≈ `[[X]]`% of volume `[[or: "[[FEE_BPS]] bps of the pool fee"]]`. At today's ~$`[[VOL_24H]]`/day that's ~`[[SOL_PER_DAY]]` SOL/day into the treasury. Small. It scales with volume and nothing else.

**Reply 3**
> Why say the creator share exists: an undisclosed one that someone finds later is fatal at our size; a disclosed one is normal. Disclosure has to come before it matters, not after someone asks.

### D4 · The lock (A3) — @organic_mycel, pinned alongside the diligence page

**Hook**
> 100,000,000 MYCEL is locked until `[[UNLOCK_DATE]]`.
>
> Not "the team promises". Locked. Here's the account — read the balance yourself.
>
> `[[LOCK_ACCOUNT]]`

**Reply 1**
> Lock tx: `[[TX_LOCK]]` · program: `[[LOCK_PROGRAM]]`
> That's 10% of the 999,850,024 supply. Mint and freeze authority are revoked and metadata is immutable, so the other 90% can't be inflated or frozen either: `[[SOLSCAN_MINT_LINK]]`

**Do not post D4 until `[[LOCK_ACCOUNT]]` is a program-held account.** If it turns out to be
a plain wallet, post this instead and mean it: *"100,000,000 MYCEL sits in `[[WALLET]]` and
will not move before `[[DATE]]`. That's a promise, not a lock. We're moving it into
`[[LOCK_PROGRAM]]` on `[[DATE]]` and will post the tx."*

### D5 · First payout receipt (C1) — @organic_mycel

**Hook**
> First person ever paid by $MYCEL for working on it.
>
> @`[[CONTRIB_HANDLE]]` — `[[BOUNTY_TEXT]]` — `[[AMOUNT]]` `[[MYCEL|SOL]]`, sent from the treasury.
>
> Receipt: `[[TX_PAYOUT_1]]`

**Reply 1**
> Where the money came from: trade fees → `[[TREASURY]]` → this tx. `[[If C6: "Bought on the market first ([[TX_BUY]]), then paid — every payout is a trade."]]`
> Next bounties go up `[[DAY]]`. Work first, then the receipt, every time.

### D6 · Founder version of D5 (quote-post, founder account)

> One transaction, and the sentence on the site stops being a promise.
>
> "Fees pay the people who do the work" was a claim this morning. It's a receipt now. Everything else in this plan is easier with one of these behind it.

### D7 · The first Ledger post — @organic_mycel, weekly format, **post it with the zeros**

**Hook**
> MYCEL Ledger · week `[[N]]` (`[[DATE_RANGE]]`)
>
> Into the treasury: `[[IN]]` SOL
> Paid out: `[[OUT]]` SOL to `[[K]]` people
> Treasury balance: `[[BAL]]` SOL
> Trades: `[[TRADES]]` · avg $`[[AVG]]`
> Holders (non-empty): `[[HOLDERS]]`
>
> Same post every week. Including weeks like this one.

**Reply 1**
> Every number above is on-chain: `https://solscan.io/account/[[TREASURY]]` · DexScreener `[[PAIR_LINK]]`. Payout receipts: `[[TX_LIST or "none this week"]]`.

If the first Ledger has `0 / 0 / 0 / 0`, post it anyway — the plan is explicit that the
format has to exist before there is good news in it.

### D8 · First three bounties — @organic_mycel (only after D5)

**Hook**
> Three bounties, priced in MYCEL, paid from the treasury. Hold gate applies: you need to have held `[[MIN_BAL]]` MYCEL for `[[MIN_DAYS]]` days to be paid.
>
> 1. `[[BOUNTY_1]]` — `[[PRICE_1]]` MYCEL
> 2. `[[BOUNTY_2]]` — `[[PRICE_2]]` MYCEL
> 3. `[[BOUNTY_3]]` — `[[PRICE_3]]` MYCEL

**Reply 1**
> Rules, so nobody is surprised later: no payment for likes · replies count only if they earned a reply back · weekly cap per wallet `[[CAP]]` MYCEL · top earners reviewed by a human before payout · paid tokens `[[vest/hold]]` for `[[PERIOD]]`. Claim here: `[[LINK]]`

Suggested first three, from the plan's own gaps (yours to price): a 60-second clip of the
build stream · a meme that uses the "colonization log" framing · one interview with a
wallet that sold out, written up.

### D9 · The diligence post (A6) — @organic_mycel, pinned

**Hook**
> Seven things you'd check before buying a coin this size. Already checked, with links.

**Reply 1**
> 1 Supply: no bundled clusters — `[[HOLDER_DIST_LINK]]`
> 2 Founder dump risk: 100,000,000 MYCEL locked to `[[UNLOCK_DATE]]` — `[[LOCK_ACCOUNT]]`
> 3 Liquidity: locked — `[[LP_LOCK_LINK]]`
> 4 Inflation/freeze: mint + freeze revoked, metadata immutable — `[[SOLSCAN_MINT_LINK]]`

**Reply 2**
> 5 Where fees go: `[[TREASURY]]` + the published split — `[[LINK_D3]]`
> 6 Who's accountable: `[[FOUNDER_HANDLE]]`, doxxed, streams weekly `[[STREAM_SLOT]]`
> 7 Is there a product: Organic, and the payouts you can audit — `[[LINK_D5]]`
>
> If one of these stops being true, this post gets edited the same day.

Items 1 and 3 need evidence that does not exist yet (holder-distribution snapshot, LP lock).
Post D9 with only the rows you can link; a row without a link is worse than no row.

---

## Order for the week, mapped to the plan's "In order"

| Day | Do | Post |
|---|---|---|
| 1 | Create `[[TREASURY]]`, proof-of-control memo tx | D1, D2 |
| 1–2 | Confirm fee mechanism + bps with Organic's config | D3 |
| 2–3 | Pay contributor #1 **from the treasury**, memo on tx | D5, D6 |
| 3 | Settle where the 100M sits (`getTokenLargestAccounts`); lock it in a program if it is not | D4 (or the honest fallback) |
| 4 | Bounties 1–3 with the hold gate | D8 |
| 5–7 | Diligence page with only linkable rows | D9, pin |
| Monday | First Ledger, zeros included | D7 |

Track B (the daily blocks) starts the day D5 is out — the plan says every archetype is
stronger with a receipt behind it, and it is right.
