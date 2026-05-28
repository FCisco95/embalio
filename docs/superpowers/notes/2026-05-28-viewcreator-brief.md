# ViewCreator.ai — Design Brief for a dispatchAI Clone

*Produced by the `viewcreator-research` workflow (6 agents) on 2026-05-28. Feeds the
multi-channel content cockpit pivot. Vendor claims flagged as unverified where noted.*

## 1. What ViewCreator actually is
ViewCreator.ai (by BridgeMind / Matthew Miller) is an AI content platform built around autonomous "agents": you define a brand profile once, then agents generate platform-native content (clips, captions, carousels, thumbnails) and **natively publish it across ~8 platforms** (YouTube, Instagram, TikTok, LinkedIn, Threads, Reddit, X, Facebook). It ships as a web app, a desktop "Studio" (local video clipping on your own API keys), a hosted MCP server, and a coming mobile app. Single plan: $50/mo (1 brand profile; +$20/mo each, up to 25). It's brand-new ("Launch Week," © 2026).

## 2. The UX model worth copying
Three patterns are the takeaway, and they map cleanly onto dispatchAI's existing pages:

- **The tool grid.** Each channel has its own page (`/tools/x`, `/tools/instagram`…) presenting a grid of single-purpose generator tiles ("Thread Architect," "Reel Script Builder," "Hashtag Pulse Finder"). A click → a short brief form → a draft. This is a discoverable, low-friction "pick a job, get a draft" surface. dispatchAI currently has one monolithic `/compose` (WeeklyComposer) — the copyable move is to explode it into a per-channel tile grid.
- **"Three steps, zero complexity."** (1) Define brand → (2) Create an agent (pick platforms + content types + schedule) → (3) Review & publish (approve, or full auto). The mental model is *brand once → agent loops → review gate*.
- **Studio = local-first cut room.** Drop a long video → it scores every moment for virality → slices vertical shorts on-device with captions baked in, showing a per-job cost line. The pattern to steal is the **scored-candidate review UI** (each clip shown with a 0–100 score), which is exactly how a "review opportunities" surface should look — and dispatchAI already does this shape in `/engage` (reply candidates) and `scoring.ts`.

How a click becomes content: brief → system auto-picks model + aspect ratio + tone per platform → templates tuned for CTR/watch-time → optional multi-step workflow (research → draft → design → export) with human-review loops.

## 3. Tool catalog (channels × tools)

| Channel | Tools (count) | Status |
|---|---|---|
| YouTube | Title, Description, Script, Chapter, Thumbnail (visual), Thumbnail Copy, Transcript, Name (8) | Live |
| X / Twitter | Viral Post Composer, Thread Architect, Reply Generator, Hashtag Pulse Finder, Audience Poll, Content Calendar Builder (6) | Live |
| Instagram | Reel Script, Carousel Caption Studio, Story Sequence Planner, Bio, Bio Refresh, Comment Responder, Hashtag Intelligence (7) | Live |
| TikTok | Hook+CTA, Script Beat Sheet, Caption, Trend Remix Lab, Retention Checklist, Idea Sprint Planner, Transcript, Username (8) | Live |
| Facebook | Ad Copy Optimizer, Ad Creative Brief, Community Post Planner, Event Promotion Kit, Lead Magnet Funnel, Live Run-of-Show (6) | Live |
| Google/SEO | SEO Blog, Content Outline, Keyword Cluster, Meta Description, FAQ Schema, Featured Snippet (6) | Live |
| Video Repurposing | Video Highlight Clip Generator (virality clipper in Studio) (1) | Live |
| LinkedIn / Threads / Reddit | *(no named generator suites)* — **publish destinations only** | Live (publish) |
| Mobile app (iOS/Android) | manage agents, publish, track from phone | **Coming soon** |
| "Scroll" platform | named once in copy | **Unverified** |

~42 named generator tools; all live. Channel groupings corroborated across sources but per-tool live status could only be field-verified for the mobile app's "Coming Soon."

## 4. Generation vs publishing — does it actually POST?
**Both, split across two layers — and yes, it genuinely posts.** This is decisive for the "start posting everywhere" goal:

- The ~42 per-channel **tools are draft generators only** (compose/outline/draft — no posting language).
- **Real publishing lives in the Agents + Studio layer**, and it is native, not mock: connect platform accounts *per brand profile*, schedule, recurring runs, optimal-time posting, and a **"approve OR auto-publish autonomously" toggle**. Studio uses your own API keys for the connections. Case study claims 2M+ views with "zero manual posts."

**dispatchAI today is the draft-generator layer only** — `generateWeeklyPosts` and `generateReplyQueue` produce drafts the owner copies out by hand. There is a half-built `adspower.ts` / `x-poster.ts` posting path (Phase 1, X-only, untested, opt-in). To match ViewCreator's pitch, dispatchAI needs the publishing layer it currently lacks.

## 5. Voice & data freshness — and the dispatchAI contrast
**ViewCreator:**
- *Voice:* a persisted **brand profile** (tone, audience, visual identity) that "agents inherit." Marketing describes the *outcome* (on-brand output); **no voice-modeling internals are disclosed** — treat the mechanism as a black box.
- *Fresh data:* a **hybrid, marketing-asserted** claim. "Hashtag Pulse Finder" (timely hashtags) and "Trend Remix Lab" (current audio) imply live signals, but **no data-freshness mechanism, source, or refresh cadence is documented**. Real-time depth is unverified.

**Where dispatchAI is already BETTER:**
- **Voice is a first-class, transparent, editable artifact** — `voice_spec` synthesized from an onboarding *interview* (not a pasted corpus), stored on `profiles`, injected into every draft via `voice-prompt.ts` builders. ViewCreator's voice is an opaque profile; dispatchAI's is inspectable and tunable. This is the strongest moat.
- **Generation is free** — all AI runs through a `generate()` wrapper shelling `claude -p` on the subscription (no per-token cost, Gemini free-tier fallback wired). ViewCreator is $50/mo on your own paid API keys.
- **Real research is structurally baked in, not asserted** — `generateWeeklyPosts` does 3 parallel `claude -p --allowedTools WebSearch WebFetch` research calls → cross-ref synthesis → drafts. dispatchAI's "fresh data" is a real verifiable pipeline; ViewCreator's is a marketing claim.
- **Owner-context-first** — HANDOFF.md + journal entry drive generation (Step 1), with web research as a context-adder (Step 2). More personal/authentic than template-tuned output.

dispatchAI is **deeper on quality/voice/truthful-research**; ViewCreator is **broader on channels + actually publishes**.

## 6. Pricing & MCP (one line each)
- **Pricing:** single plan, no tiers — $50/mo incl. 1 profile, +$20/mo per extra (max 25), 14-day refund, launch code `FOUNDER` = $25/mo; monthly only (no annual seen).
- **MCP:** hosted server at `https://mcp.viewcreator.ai/mcp` (Bearer-key auth, HTTP transport), exposing exactly 5 tools — `list_agents`, `get_agent`, `create_agent`, `run_agent` (real publish), `get_run_status` — so any MCP client (Claude Code, Cursor) drives agents end-to-end; included in every plan.

## 7. Gap analysis for HIS goal
Goal: *post quality, voice-consistent content to every social, on fresh data, best AI skill per task.*

**What ViewCreator does that dispatchAI lacks:**
1. **Actual native multi-channel publishing** (dispatchAI only drafts; has an untested X-only AdsPower path).
2. **Breadth** — 6+ channels with platform-specific generators; dispatchAI is X-centric.
3. **A discoverable tile-grid UX** per channel (dispatchAI has one composer page).
4. **Scheduling / recurring "post every morning" cadence** (dispatchAI is one-click-on-demand; subscription `claude -p` can't run on Vercel cron — see handoff §1).
5. **Local video → scored shorts clipping** (out of scope for a text-first clone unless he wants short-form).

**What dispatchAI already does BETTER:** transparent editable `voice_spec` (vs opaque profile), free generation (vs $50/mo on your keys), verifiable live web-research pipeline (vs asserted "trends"), owner-context-first authenticity.

**The 4–6 capabilities a clone must add:**
1. **Per-channel adapter + publish layer** behind one `publish(channel, draft)` interface, mirroring the existing `posting.ts`/`outcome.ts` shape — and **fix the two open `posting.ts` correctness bugs first** (success-on-failed-DB-write; ambiguous-outcome duplicate-post risk; handoff §5) before going multi-channel, or the bug multiplies per channel.
2. **Channel tile-grid UI** — explode `/compose` into per-channel pages of single-purpose tiles (Thread, Reply, LinkedIn post, IG caption), each a brief → draft, reusing `voice-prompt.ts` builders.
3. **A real fresh-data layer** that beats ViewCreator's vague claim — already partly built (`WebSearch`/`WebFetch` research calls); add a per-channel trends fetch (Google Trends via pytrends, Reddit via YARS, X via existing seed-scan). All free.
4. **"Best skill per task" router** — apply the model-routing table (voice/copy → Opus, classification/JSON → GPT-4.1, summarize → Sonnet, batch → Haiku) inside `generate()`; currently everything goes to one `claude -p` backend.
5. **Scheduling** that respects the subscription constraint — a local long-running runner (the `tmux`/background-process pattern), NOT Vercel cron, since `claude -p` only works where `claude` is authenticated locally.
6. **(Optional) ship the 5-tool MCP server pattern** — expose dispatchAI's nouns/verbs (`list_profiles`, `generate_weekly`, `generate_replies`, `publish`, `get_status`) so he can drive it from Claude Code without the UI.

**Likely API/integration list (per channel) — free vs paid:**
| Channel | Integration | Cost |
|---|---|---|
| X / Twitter | Official API v2 (paid, declined per handoff) **or** AdsPower browser automation (existing, free, fragile/untested) | Paid / Free |
| LinkedIn | Official API (OAuth, restricted approval; partner access often gated) | Free tier, approval-gated |
| Instagram / Facebook | Meta Graph API (free; requires Business/Creator account + app review) | Free, review-gated |
| Threads | Threads API (Meta, free, OAuth) | Free |
| Reddit | Reddit API (free tier w/ rate limits; OAuth script app) | Free (rate-limited) |
| YouTube | YouTube Data API v3 (free quota) | Free (quota-capped) |
| TikTok | TikTok Content Posting API (free; app approval + audited scopes) | Free, approval-gated |
| Generation | `claude -p` subscription (existing) + Gemini free fallback | Free |
| Trends/data | pytrends (Google), YARS (Reddit), existing WebSearch/WebFetch | Free |

**Flagged / unverified:** ViewCreator's voice mechanism and live-data pipeline are marketing claims, not documented internals; "Scroll" platform and the 8th-platform count are unconfirmed; case-study metrics are vendor self-reported; annual pricing not seen but not disproven. On the integration side, every "official API" above is free at low volume but most (Meta, TikTok, LinkedIn, X-write) are **approval-gated** — AdsPower-style browser automation is the only zero-approval path and is fragile/ToS-risky.
