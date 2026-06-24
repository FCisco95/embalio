# GATE-2 ignition — reconciliation + Day-1 checklist (2026-06-23)

Source: 17-agent audit/research/debate session. Full strategic report lives in the vault:
`cisco-brain/10 - PROJECTS/Embalio/research/Embalio — Improvement Report (2026-06-23).md`.
This note is the repo-local, executable half.

## TL;DR

GATE-1 shipped the manual-send sniper, but **GATE-2 cannot physically start today.** Three config
gaps sit *under* the "GATE-1 shipped" headline. None are new features — they fit the
validate-not-build freeze. Fix them in one PR, then dogfood.

**Resolved decisions (do not re-litigate):**
- **P4 Predictions + P6 Strategy Engine are FROZEN** — they shipped against the explicit Q3 cut;
  zero further investment, no P7 hooks into them, until GATE-2 clears. Keep their numbers OUT of
  how GATE-2 is judged (both are decorative / disconnected from OON reach).
- **Reach (~0.66% OON) is the metric GATE-2 is judged on.** Pass only if sniper replies measurably
  move OON reach — not if "alerts fire."
- **YouTube Phase-1 Studio UI is already in `main`** (not shelved on a branch). Frozen-in-place.

## The three ignition blockers (verified)

1. **No in-band seed.** `supabase/seeds/` directory does not exist; the watch list is still 100k+
   handles, so `sizeFit` collapses and pulls go stale (Session-12 live-fire = `alerts:0`).
   → Write + run `supabase/seeds/2026-06-22-inband-handles.sql` with 4–6 handles in the 2.6–13k band.
2. **`REPLY_INTENT_ENABLED` unset in every env.** While unset, `src/server/sniper.ts:290-291` falls
   back to `buildStatusUrl` → the headline one-tap pre-filled reply is **dark in production**.
   → Set `REPLY_INTENT_ENABLED=1` on Vercel; verify the native composer pre-fills on a phone.
3. **Telegram Sent/Skip confirm path is dead.** `alertButtons` emits `alert:sent:<id>` /
   `alert:skip:<id>` (`src/server/sniper.ts:101-102`) but `parseCallback` only matches
   `/^(posted|skip):/` (`src/lib/telegram-callback.ts:4`) → returns null → dropped; and
   `/api/telegram/poll` is in *neither* `vercel.json` *nor* any `.github/workflows/*`.
   → Cheapest correct fix: **delete the `alert:sent/skip` callback row** from `alertButtons`, keep
   the working Open + Copy URL buttons. The `/engage` web pin already records sends and feeds caps.
   (If you later want in-Telegram confirm: extend `parseCallback`+`applyCallback` for
   `alert:sent|skip:<id>` against `sniper_alerts` AND schedule the poll route.)

## Two more fixes that ride the same PR (freeze-safe)

4. **Relevance defaults to 0.5 on embedding failure** (`src/lib/embeddings.ts:8,13`). Combined with
   `recency=1` + `sizeFit=1`, a fresh in-band post clears the 0.6 threshold on freshness alone →
   false-positive alerts that corrupt the exact data you're grading. **Floor failed/zero embeddings
   to relevance 0** (or skip the candidate). 2 lines.
5. **`caps.ts` header overstates.** It says "enforced, not coached / non-bypassable," but `checkCaps`
   runs only at pin-render to disable a button; `markSniperReplySent` (`src/server/sniper.ts:328-343`)
   does no check. For a manual-send product you cannot hard-block a human from x.com, so *advisory* is
   the honest word. **Downgrade the comment to "advisory guardrail."** 2-line doc fix.

## Day-1 sequence

- [ ] **Start recruiting 3 strangers in parallel** (highest schedule risk vs 2026-09-04; no code de-risks it).
- [ ] One PR: seed (1) + env var (2) + delete dead buttons (3) + relevance floor (4) + caps wording (5).
- [ ] Pre-flight: one manual `workflow_dispatch` of the sniper poll; confirm `pulled>0` for the new handles.
- [ ] Fire **1 real alert end-to-end** (detect → draft → notify → manual send → `status='acted'`).
- [ ] 7–10 day @FCisco95 dogfood, judged on the report's reach scorecard (visits/day +≥25% vs prior
      week, traceable to reply days; ≥3 replies each clearing ≥2× the author's median reply impressions;
      precision ≥70% / false-alert ≤30%).
- [ ] **Before any stranger's data hits the shared DB: write the GDPR LIA one-pager.** The repo
      permanently warehouses others' tweets (`src/lib/signals/warehouse.ts:29`; `signal_tweets.deleted_at`
      is never written — no purge). EDPB Guidelines 1/2024 require the LIA *before* processing; the
      first stranger is inside the gate. This overrides the Q3 plan's "defer LIA to first paying client."
- [ ] Free + codeless reach win to run alongside (not in this repo): strip external links from main
      tweets (link-in-reply), native video/threads, buy X Premium.

## Keep / cut / defer (engineering view)

| Item | Decision |
|---|---|
| Seed in-band handles · `REPLY_INTENT_ENABLED=1` · delete dead Telegram buttons · relevance floor · caps wording | **KEEP — day 1, one PR** |
| Re-aim sniper drafts from latency to reply-quality + earliness (`drafting.ts`/`voice-prompt.ts`) | **KEEP — gate window** |
| Reply-impression capture on acted alerts · `skip_reason` column + 4 Skip buttons · visits/day KPI on `/performance` | **KEEP — gate window** |
| Server-side cap enforcement at `markSniperReplySent` (+ DB uniqueness for within-session dups) | **DEFER — post-gate** |
| P7 (RLS on ~17 service-role tables · tier hooks · weekly report card · per-profile Telegram) | **DEFER — post-gate** |
| P8 (Stripe · twitterapi.io stream · Grok) — adapters exist in `signals/index.ts`, keep OFF (validation = $0 Apify) | **DEFER — post-gate** |
| Sniper studio-original-post AdsPower removal (last remaining auto-post vector; `posting.ts` only blocks `kind==='reply'`) | **DEFER — first thing post-gate** |
| X API official write integration | **FREEZE — reintroduces the auto-post vector GATE-1 severed** |
| YouTube Phase-1 UI (`studio/*`, in main) · overlay (`desktop/`) · P4 · P6 | **FREEZE — no investment; ~1.5–2 days to make overlay stranger-safe post-gate** |
| Relax `youtube.ts` `FORCED_PRIVACY` | **DEFER → Week-6 tripwire (~2026-07-30), only if sniper on-track** |
| YouTube Phase-0 skill chain (`/video-research → /video-script → /video-render`) | **CUT — net-new scope on a 2nd platform; revisit only post-gate** |

## Other verified findings (context, not gate-blocking)
- **Overlay crash:** `desktop/sidecar/server.js:13` `spawn('python')` has no `.on('error')` → ENOENT
  crashes the Electron main process; per `docs/HANDOFF.md:55` bare `python` doesn't resolve on the dev
  box, so this is the *default* first-run condition. 3-line guard worth doing if you personally record.
- **Predictions data bug:** receipts duplicate on every `/performance` load (`predict.ts:57` from an
  uncached server component) — will corrupt any future backtest. Fix post-gate.
- **"$0 Apify" is really "cheap Apify":** `SIGNAL_SOURCE='apify'` runs a paid actor per poll
  (~64 runs/day/profile). No free tier for this actor pattern; restate the constraint honestly.
- **Alert volume ungoverned:** up to ~64 polls/day × 3 alerts, no throttle tied to the 50/day budget →
  ~100+ notifications/day possible. Alert-fatigue risk for a 2-week dogfood; consider a daily alert cap.
