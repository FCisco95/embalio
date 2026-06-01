# Embalio — Handoff (canonical)

**Last updated:** 2026-06-01
**Branch:** `make-it-true` — integration tip. Workstreams converged here:
`make-it-solid` (resilience), `harden/make-it-safe` (security/RLS), `make-it-true`
(real-data dashboard), and now `feat/onboarding-quiz` (quiz-style first-account
setup — merged 2026-06-01). Pushed to `origin/make-it-true`. See `docs/NORTH-STAR.md`.
**Scope:** local single-user X growth engine → growing toward a multi-user product.

This is the canonical, living handoff for this repo. It is auto-loaded at the
start of each session by the `handoff-memory` plugin's SessionStart hook.
Point-in-time session snapshots live in `docs/handoffs/`.

---

## TL;DR — Embalio, 2026-05-31

Rebranded **dispatchAI/Resonance → Embalio** (`embalio.com`). Local single-user X
growth engine; generation = `claude -p` on the owner's Claude **Max** plan (free, Opus).

**Apex feature "Pulse" is built + proven live:** scan opportunity → draft comment
(claude) → push to **Telegram** with a **tap-to-copy reply + ✅Posted/⏭️Skip** buttons.
Files: `src/lib/telegram.ts`, `src/server/pulse.ts`, `src/app/api/pulse/route.ts`
(`?refresh=0` = deliver-only). Verified with a seeded ping to the owner's phone.

**Resilience (make-it-solid):** `withRetry` on the claude runner + Apify; research
briefing cache (research once/day); UI error boundaries; targeting split so the
**scan cron is cloud-safe** (claude drafting is local-only); tracking cron → daily.

**Env (`.env.local`, per-machine, gitignored):** ✅ Telegram, ✅ Supabase (Embalio
project, schema live, `FIXED_PROFILE_ID` = fcisco95 profile), ✅ CRON_SECRET.
⏳ Pending for REAL opportunities: `APIFY_TOKEN`, `APIFY_TWEET_SCRAPER_ACTOR`,
`OPENAI_API_KEY`, and `seed_targets` rows. Pulse is demo-seeded until then.

**Status:** build green; tests 164 pass / 1 skipped (`rls.test.ts` gated behind
`RUN_RLS_INTEGRATION=1`). Open security item: multi-tenant read-RLS on `profiles`
(the gated test is the canary — user B can still read user A's profile).

**NEW — Onboarding quiz (`feat/onboarding-quiz`, merged 2026-06-01):** quiz-style
first-account setup at **`/setup`** (takeover route outside the `(app)` group, so no
nav chrome; `force-dynamic` so the profile id resolves per-request). One-question-
per-screen, tap-first (chips/toggles/buttons + optional open text), progress bar.
Collects handle, account size, X-Premium, pillars, goal, daily capacity, voice
method. Then the app **synthesizes the voice spec** (`synthesizePersona`) and
**recommends who to follow** (`recommendTargets`, extracted from `generateTargetQueue`);
the user curates toggles → persists `voice_spec` + `seed_targets` via `finalizeSetup`
→ `savePersona`. Voice can be auto-pulled from the user's own posts
(`pullOwnVoiceCorpus`, Apify). Empty accounts are redirected into `/setup` from the
dashboard via `needsSetup(profile)`. Spec: `docs/superpowers/specs/2026-05-31-onboarding-quiz-design.md`;
plan: `docs/superpowers/plans/2026-05-31-onboarding-quiz.md`. No schema migration
(all columns already existed). New files: `src/lib/setup-steps.ts`, `src/lib/setup-logic.ts`,
`src/server/voice-pull.ts`, `src/server/setup.ts`, `src/components/setup-quiz.tsx`,
`src/app/setup/page.tsx`; modified `src/server/target-queue.ts`, `src/app/(app)/page.tsx`.

> **⚠ Tracked follow-ups for the onboarding quiz (don't lose these):**
> 1. **Client-strategy debt:** `finalizeSetup` (`src/server/setup.ts`) updates the
>    profile via `supabaseService` (service-role) but calls `savePersona`, which uses
>    `supabaseServer` (anon/RLS). Harmless in the current local single-user, no-auth
>    setup, and it mirrors a pre-existing repo-wide split — but **when RLS lands the
>    anon-path writes could be denied while the service write succeeds, half-finalizing
>    a profile.** Fix as part of the RLS workstream (unify the client strategy
>    repo-wide); patching just this spot would duplicate `savePersona` logic.
> 2. **Unwired inputs:** `accountSize` and `daily capacity` are collected but not yet
>    wired into recommendation sizing / pulse cadence (deferred in spec §9).
> 3. **Onboarding voice-pull needs `APIFY_TOKEN`** to work; otherwise it falls back to
>    paste/tags. Same key gap as Pulse below.

**Earlier "make it true" workstream (still valid):** dashboard derives every card
from real DB rows with honest empty states; Performance accepts real per-post metrics;
weekly composer + reply queue persist to the sign-off queue.

> **▶ DO THIS NEXT (Pulse tasks #7–10):**
> 1. Make Pulse real — wire Apify + OpenAI + add `seed_targets` (accounts to watch).
> 2. Schedule Pulse via launchd. 3. Wire Posted/Skip callbacks. 4. Pulse dedup
> (don't re-ping the same opportunity) + delete the demo @naval seed row.

**The closed loop now works end-to-end (no fabrication):**
generate (weekly/reply) → Save to queue → pending count → Mark posted →
Performance → enter real numbers → dashboard reach/top-post/strategy fill in.

**Secondary next-session options:**
- **Feed the board's free targets into the dashboard.** "Today's targets" reads
  the `candidates` table, which only the Apify cron fills (can't run locally).
  The free `claude-p` board path (`generateTargetQueue`) doesn't persist yet —
  add a persistence step so the board's results surface on the dashboard.
- **Apify stack** is kept (decision: keep & improve), but is non-functional
  locally — crons need a deployed env. Improving it into a real pipeline is a
  separate workstream.
- Continue the ViewCreator.ai-style cockpit pivot brainstorm:
  `docs/superpowers/notes/2026-05-28-viewcreator-cockpit-brainstorm.md`

### "Make it true" — what changed (branch `make-it-true`)

| Area | Change | Files |
|------|--------|-------|
| Pending count | Was filtering `status='pending'` (never written) → always 0. Now filters real unposted statuses (`draft`/`approved`). | `src/server/posts.ts` |
| Metrics source | New `updatePostMetrics` (zod-validated `posts.metrics`; the single seam the X API swaps into later) + `saveDraftToQueue` + `PostMetrics` schema. | `posts.ts`, `lib/schemas.ts` |
| Performance | Read-only table → inline `MetricsRow` editor (likes/reposts/replies/views → Save). | `performance/page.tsx`, `components/metrics-row.tsx` |
| Dashboard | Dropped fake `REACH/STRATEGY/TOP_POST/TARGETS`. New `getDashboardData()` derives reach, top post, data-only strategy insight, and real candidates; honest empty states. `formatCount` → `lib/format`. | `page.tsx`, `server/dashboard.ts`, `lib/format.ts` |
| New flows persist | Weekly composer + reply queue got "Save to queue" + "Mark posted". | `weekly-composer.tsx`, `reply-queue.tsx` |

Build green; 128 tests pass (1 skipped). The 2 pre-existing failures from the
prior handoff (`buildAlgorithmRulesBlock` stub) are resolved.

---

## 1. What was built this session

### Dispatch design system — full visual parity

Full spec: `docs/superpowers/specs/2026-05-29-dispatch-design-system.md`
Full plan: `docs/superpowers/plans/2026-05-29-dispatch-design-system.md`

**14 commits, outside-in approach:**

| Commit | What |
|--------|------|
| `3be3c86` | Card padding 20px, CardTitle font-semibold |
| `d283836` | Tabs line variant accent underline + brand-text active |
| `afa00bd` | Input/Textarea bg-background + accent focus ring; new: StyledSelect, Skeleton, BrandAvatar, ScorePill/ScoreBar |
| `38f9576` | Cockpit: Card, BrandAvatar, Skeleton loading |
| `aade35d` | Compose: Card, Skeleton loading, StyledSelect, thread connectors |
| `c9a54be` | Engage: Dispatch tab underline, Card cards, StyledSelect |
| `328d02e` | Board: Card, ScorePill/ScoreBar, StyledSelect |
| `0762dbe` | Profiles: overline section titles, Card, BrandAvatar, Input |
| `30c4ac0` | Fix: CardHeader grid, label a11y, remove dynamic rows |
| `c787427` | Charts: Sparkline SVG |
| `0528a76` | Charts: BarChart SVG with hover |
| `bee7f08` | Charts: AreaChart SVG with crosshair + tooltip + ResizeObserver |
| `cb83fef` | Performance: stat chips, AreaChart + BarChart, segmented filter, styled table |
| `eb02439` | Fix: React import in StyledSelect, rel on external link, AreaChart label dedup |

### New files created

```
src/components/ui/select-native.tsx   → StyledSelect
src/components/ui/skeleton.tsx        → Skeleton, SkeletonLine, SkeletonBlock
src/components/ui/brand-avatar.tsx    → BrandAvatar
src/components/ui/score-bar.tsx       → ScorePill, ScoreBar
src/components/charts/sparkline.tsx   → Sparkline (pure RSC, no hooks)
src/components/charts/bar-chart.tsx   → BarChart ("use client", hover state)
src/components/charts/area-chart.tsx  → AreaChart ("use client", ResizeObserver, crosshair)
```

### Known remaining gaps (not in scope of this session)

- `angle-composer.tsx`, `composer.tsx`, `onboarding-wizard.tsx` still use raw
  `<select className="border rounded...">` and raw `border rounded` divs — small
  follow-up to apply StyledSelect/Card there too.
- `buildAlgorithmRulesBlock()` in `src/lib/voice-prompt.ts` is a stub → 1 test failure.
- `src/lib/supabase/rls.test.ts` — 1 pre-existing failure (RLS isolation test), not
  caused by this session.

---

## 2. App architecture (unchanged)

- **Platform:** local Next.js app. Run via `npm run dev`.
- **Generation:** all AI calls go through `generate()` which shells `claude -p`.
  No API keys, no per-token cost. Gemini fallback wired but unused.
- **Voice:** built by onboarding interview → `voice_spec` in Supabase.
- **Human-in-the-loop:** nothing auto-posts; engine drafts, owner copies.
- **X API:** still declined (cost); posting stays AdsPower-only (opt-in, untested).
- **Generation** is local-only (`claude -p`). **Scan + tracking crons are cloud-safe**
  (Apify + OpenAI, no claude) and can deploy to Vercel; the **Pulse** route + claude
  drafting stay local. Stage 2 (product) swaps generation to an API — see NORTH-STAR.

---

## 3. Pending items from prior sessions

- **ViewCreator.ai-style cockpit pivot** (paused 2026-05-28): multi-channel content
  cockpit, no login, one-click tile grid. Brainstorm notes at
  `docs/superpowers/notes/2026-05-28-viewcreator-cockpit-brainstorm.md`.
  Research workflow at `docs/superpowers/workflows/viewcreator-research.workflow.js`.
- **x-growth skills** to wire into `buildAlgorithmRulesBlock()`.
- **3 Codex adversarial findings** from a prior session (referenced in old handoff §4).

---

## 4. How to run

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build — green
npm test             # 146 pass / 1 skipped (RLS integration gated)
```

### Resume on another machine (e.g. Windows)
1. `git fetch origin && git checkout make-it-true && git pull`
2. That machine needs its **own** `.env.local` (gitignored — never synced by git),
   with matching values, and the `claude` CLI logged in (Max plan) for generation.
3. Pulse deliver-only smoke test: `npm run dev`, then GET
   `http://localhost:3000/api/pulse?refresh=0` with header `Authorization: Bearer <CRON_SECRET>`.
