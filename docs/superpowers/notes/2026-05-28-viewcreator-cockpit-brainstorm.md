# Brainstorm: dispatchAI → ViewCreator-style multi-channel content cockpit

**Date:** 2026-05-28
**Status:** Brainstorm PAUSED mid-design (HARD-GATE: no implementation until design approved).
**Reason for pause:** User is out of weekly Claude session limit; resuming after midnight reset
(start of 2026-05-29) in a fresh session. A scheduled reminder was set for midnight.

---

## The pivot (new vision, expands the original "kill the login" ask)

User wants to **replicate ViewCreator.ai** (https://www.viewcreator.ai/) — its UX/feel —
but turned into a **personal tool** whose real goal is:

> Post **quality, voice-consistent** content to **every social channel** he wants,
> powered by **fresh / real daily data**, using the **best AI skill per task** in a clean workflow.

- Reference app to study: **ViewCreator.ai** — navigate Pricing, Studio, MCP, Company. Look at
  screenshots of how it works. (BridgeMind / "Vibeathon" / "vibe coding" ecosystem.)
- He is **willing to connect APIs** (start free; upgrade to paid later, **including the X API**)
  once it works and he likes it.

## NEXT STEP (do this first next session)

Run the saved research workflow to study ViewCreator before finalizing design:

```
Workflow({ scriptPath: "docs/superpowers/workflows/viewcreator-research.workflow.js" })
```

It fans out 5 research agents (product/studio, tool catalog, pricing, MCP, company) +
a synthesis agent → a design-oriented brief (incl. generation-vs-publishing, voice/data
freshness, and a gap analysis with the per-channel API list, free vs paid).

After the brief lands: **the scope is now large (multi-channel + publishing + multiple API
integrations) — likely DECOMPOSE into sub-projects** per the brainstorming skill, then design
the first sub-project (almost certainly: the no-login cockpit + X channel end-to-end) and only
then proceed to writing-plans.

---

## Decisions LOCKED in this brainstorm (still valid)

1. **Reskin over the brain** — keep everything dispatchAI already does (voice_spec, seed
   targets, web research, real reply opportunities). Repackage the front-end as a ViewCreator-style
   one-click tile grid. Most value is already built.
2. **Trusted local mode (no auth)** — remove the login page, the magic-link flow, the
   `/auth/callback` route, and the middleware redirect. Server talks to the DB via the
   **service-role client** against **one fixed profile** (`fcisco95`, id
   `7a728122-569a-4db0-8773-1e537fd1a92f`). Open localhost → you're in. NOT safe to expose
   publicly as-is (matches today's local-only setup; the deployed cron path is separate).
3. **All 6 home tiles in v1**, including the net-new one:
   🔍 Research the week · 💬 Who to reply to · ➕ Who to follow (NEW) ·
   ✍️ Generate posts · 🧵 Draft a thread · 🎙️ Tune my voice.
4. **Shared weekly briefing (cached)** — research runs ONCE (on click / first open of the day),
   produces a readable briefing, and is **cached** (proposed new `research_briefings` table,
   keyed by profile + day). Generate-posts / who-to-reply / who-to-follow all **reuse the cache**
   → instant after the first ~2-min run. Each tile shows progress + a "researched Xh ago · re-run".
5. **Build approach A (recommended)** — thin reskin + briefing cache. Split the research step
   out of `generateWeeklyPosts` into a `getWeeklyBriefing()` that runs-or-returns-cached;
   posts/reply/follow consume it. Collapse the profile-switcher (only one of you) opportunistically.
   Approach B (full backend consolidation) deferred as premature.

## Open question carried forward
- The vision now spans MANY channels + actual publishing + several APIs. Before writing the
  spec, decide decomposition: which sub-project ships first (recommend: no-login cockpit + X
  end-to-end on free data), and the channel/API rollout order. The ViewCreator brief will inform this.

## Relevant existing code (for the reskin)
- Auth to remove: `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`.
- DB access: `src/lib/supabase/server.ts` (`supabaseServer` anon+cookies → switch app reads to
  `supabaseService` service-role); RLS becomes moot locally.
- Brain to reuse: `src/server/original.ts` (`generateWeeklyPosts`), `src/server/engage.ts`
  (`generateReplyQueue`), `src/server/persona.ts`, prompt builders in `src/lib/voice-prompt.ts`,
  free generation via `src/lib/generate/*` (`claude -p`).
- UI to reskin: `src/app/(app)/{board,compose,engage,performance,profiles}/page.tsx`,
  nav in `src/app/(app)/layout.tsx`, `src/components/{weekly-composer,reply-queue}.tsx`.
- Home grid: new `/` (currently redirects).

## Session sidenotes
- Handoff was STALE on the active profile: real usable profile is `fcisco95` (has voice_spec +
  7 pillars), owned by `cisco.vieira25@gmail.com` — NOT the `dogfood4@test.dev` the handoff named.
- **Turbopack flicker bug:** Playwright MCP writes artifacts into `.playwright-mcp/` inside the
  repo; Next 16's Turbopack watcher rebuilds on every write (does NOT honor `.gitignore` for
  watching) → infinite Fast Refresh loop / UI flicker. Fix: don't drive this app via Playwright MCP
  in dev (use a headless script), or add a Turbopack watch-exclude for `.playwright-mcp/`.
