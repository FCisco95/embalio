# Content Intelligence Agent — Design Spec

**Date:** 2026-05-27  
**Project:** Resonance  
**Status:** Approved for implementation

---

## 1. Problem

The current `/compose` flow researches the web and proposes generic angles based on content pillars. It:
- Has zero input from what Cisco is actually doing
- Generates one post at a time with no weekly planning
- Produces newsletter-style writing, not builder voice
- Has no cross-referencing between world events and personal context

The result is posts that sound like "X has been shown to Y" instead of "I ran X and it broke because Y."

---

## 2. Goal

A **content intelligence agent** that:
1. Reads Cisco's actual context (what he's building, what he cares about)
2. Researches the world in parallel (X hot topics, GitHub trending, tech news) — last 24-48h only, dates enforced
3. Cross-references world events with personal context to find genuine intersections
4. Drafts 3-5 posts for the week — different formats, all sounding like a builder texting a peer
5. Applies humanizer rules automatically — no AI tells, no newsletters

The gold-standard output format is the BridgeMind-style post:
- One sentence per line
- Personal narrative arc: before → trigger → now
- Real numbers and specifics
- Screenshot/proof element when available
- Casual, first-person, no hype

---

## 3. Architecture

### 3.1 Orchestration flow

```
[Load Cisco context]         ← instant, reads local files + DB
       │
       ├── [Research: X hot topics]       ─┐
       ├── [Research: GitHub trending]     ├── parallel, 3 concurrent claude -p calls
       └── [Research: Tech news / HN]     ─┘
                │
       [Cross-reference synthesis]         ← one call: world × Cisco context → 5 angles
                │
       [Draft 5 posts in parallel]        ← one call per format, humanizer rules baked in
                │
       [Output: weekly post plan]         ← 5 posts, each with format + context + source
```

### 3.2 Context layer (Step 1)

What the agent knows about Cisco before it looks at the world:

- **voice_spec** — from DB (already exists)
- **content_pillars** — from DB (already exists)  
- **current projects** — read from `docs/HANDOFF.md`, section "What Spine X built" and "Next developments"
- **journal entry** — optional free-text input from the user: "this week I shipped X, broke Y, noticed Z"

The context block is built by a new `buildCiscoContextBlock(profile, handoffText, journalEntry?)` function. It tells the agent: this is who you are, this is what you're building right now, this is what you noticed this week.

### 3.3 Research layer (Step 2)

Three parallel `claude -p` calls, each with `--allowedTools WebSearch WebFetch`:

**Thread A — X/Twitter hot topics**
- Search: what's being debated in AI/dev/crypto on X in the last 24-48 hours
- Output: 3-5 topics with date, tweet count/vibe, representative posts
- Strict date filter: skip anything older than 48h

**Thread B — GitHub trending**  
- Fetch: github.com/trending (today + this week)
- Filter: repos related to Cisco's pillars (AI tools, agentic workflows, dev infra, crypto x AI)
- Output: 3-5 repos with stars, what it does, why it might matter to Cisco

**Thread C — Tech news**
- Search: major tech announcements, releases, debates in last 24-48h
- Focus: Anthropic, OpenAI, AI tooling, developer infrastructure
- Output: 3-5 news items with date and source URL

### 3.4 Synthesis layer (Step 3)

One synthesis call with all research + Cisco context. The prompt asks:

> "Cisco is building [X]. Today in the world: [research]. Where do these genuinely intersect? Find 5 angles — one per format. Only propose an angle if the connection is real, not forced. If there's a humor angle (Cisco has personal experience with something everyone is talking about), include it. If there's nothing funny, skip the reactive slot and give a second experiment or observation instead."

Output: 5 angles, each with:
- `format`: one of the five types
- `hook`: the core idea in one sentence
- `connection`: why this connects to Cisco specifically (1 sentence, not shown to user)
- `source`: URL + date if web-sourced

### 3.5 Draft layer (Step 4)

Five parallel draft calls, one per angle. Each call receives:
- Cisco's voice system (voice_spec)
- The angle (format + hook + source)
- Format-specific instructions (see §4)
- Full humanizer rules baked in

### 3.6 Extension point for X algorithm skills

When Cisco's X algorithm skills are complete, they plug in here as an additional prompt block appended to every draft call:

```typescript
buildAlgorithmRulesBlock(format)  // returns string | ""
```

Until those skills exist, this returns `""` and the draft calls use the base format rules only.

---

## 4. Post formats

Target: 5 posts per run (one per format). Minimum: 3 (skip `reaction` if not genuine, skip `tool-find` if no relevant repo found). Never pad with a weak angle to hit 5. Each has a specific structure that matches how real builders post.

### `quick-take`
**Trigger:** Strong opinion Cisco holds about something current  
**Structure:** 1-3 sentences max. No setup. State the opinion directly. Maybe one "here's why" sentence.  
**Voice target:** "@bridgemindai" reply energy — confident, no hedging  
**Length:** Under 200 chars preferred  
**Example feel:** "parallel agents aren't hard to set up. they're hard to debug when one hangs."

### `experiment`
**Trigger:** Something Cisco tried, tested, or broke  
**Structure:** What I tried → what happened → what I learned (or didn't)  
**Voice target:** BridgeMind main post structure — narrative arc, personal numbers  
**Length:** 4-8 sentences, one per line  
**Ends with:** A genuine question that invites replies ("anyone else hit this?", "what do you use for X?")

### `tool-find`
**Trigger:** Interesting repo or tool from research that overlaps Cisco's work  
**Structure:** What it is (one sentence) → what I found interesting about it specifically → optional: what I'd use it for  
**Voice target:** Peer recommendation, not a product review  
**Length:** 3-5 sentences  
**Rule:** Must reference Cisco's specific context, not generic "this is useful for developers"

### `observation`
**Trigger:** Pattern Cisco has noticed while building, now validated or contradicted by world events  
**Structure:** "I keep seeing X" or "noticed Y while building Z" → what it means → personal take  
**Voice target:** Thinking out loud, not concluding  
**Length:** 3-6 sentences

### `reaction`
**Trigger:** Real-world event × Cisco personally uses/cares about the thing  
**Structure:** Before state → event/trigger → now state → numbers/proof if available  
**Voice target:** Cisco's reply to BridgeMind: "Weird... I was fine before. Now I feel like I'm reaching super easy."  
**Rule:** Only generate if Cisco personally uses or has direct experience with the thing being discussed. "Forced" means: the event is real but Cisco has no personal stake — skip it and add a second `observation` instead.  
**Proof element:** If there's a screenshot or metric Cisco could attach, suggest it in `suggestedVisual`

---

## 5. Voice rules (applied to all formats)

These are enforced in the draft prompt, not as post-processing:

- Lowercase sentence starts (already in voice_spec, now in prompt)
- First-person throughout. "I ran X" not "X has been shown to"
- One sentence per line for multi-line posts
- No em dashes (—). Use period or comma.
- No newsletter-isms: no "this week in", no "deep dive", no "game-changer", no "it's worth noting"
- No AI tells: no "delve", no "tapestry", no "pivotal", no "underscore"
- Specific over vague: name the tool, the number, the date. Not "recently" or "some models"
- Opinion over summary: a take, not a recap
- Real numbers when available
- Emoji: max 1, only if it's genuinely earned (not decorative)

---

## 6. Schema additions

```typescript
// src/lib/schemas.ts additions

export const WeeklyPost = z.object({
  format: z.enum(["quick-take", "experiment", "tool-find", "observation", "reaction"]),
  hook: z.string(),           // the angle that inspired this post
  posts: z.array(z.string().max(280)).min(1).max(7),  // tweet or thread
  context: z.string(),        // why this angle — shown to user for transparency
  source: z.string().optional(),        // URL if web-sourced
  sourceDate: z.string().optional(),    // "May 27, 2026" — enforced 24-48h window
  suggestedVisual: z.string().optional(),
});
export type WeeklyPost = z.infer<typeof WeeklyPost>;

export const WeeklyPostPlan = z.object({
  weekOf: z.string(),         // "2026-05-27"
  posts: z.array(WeeklyPost).min(1).max(5),
});
export type WeeklyPostPlan = z.infer<typeof WeeklyPostPlan>;
```

---

## 7. New code to write

### `src/lib/handoff-reader.ts`
Reads `docs/HANDOFF.md` and extracts the relevant "what I'm building" text. Returns a clean string. Used by `buildCiscoContextBlock`.

### `src/lib/voice-prompt.ts` additions
- `buildCiscoContextBlock(profile, handoffText, journalEntry?)` → string
- `buildWorldResearchPrompt(thread: "x-topics" | "github" | "news", date: string)` → string
- `buildCrossRefSynthesisPrompt(ciscoContext, research, date)` → string (distinct from existing `buildSynthesisPrompt` which is for persona/onboarding)
- `buildWeeklyDraftPrompt(voiceSystem, angle, format)` → string
- `buildAlgorithmRulesBlock(format)` → string (stub, returns `""` until X skills exist)

### `src/server/original.ts` additions
- `generateWeeklyPosts(profileId, journalEntry?)` → `WeeklyPostPlan`
  - Step 1: load context (DB + handoff file)
  - Step 2: run 3 research calls in parallel
  - Step 3: synthesis call
  - Step 4: 5 draft calls in parallel
  - Step 5: return plan (optionally save to `drafts` table)

### `src/components/weekly-composer.tsx` (new, replaces `angle-composer.tsx` on `/compose`)
- Optional textarea: "What are you working on this week?" 
- One button: "Generate this week's posts"
- Loading state with progress messages ("Researching the world...", "Finding your angles...", "Drafting...")
- Output: 5 post cards, each showing format badge + context sentence + editable post body + copy button
- No second screens, everything inline

---

## 8. What stays the same

- `composeOriginalForProfile` — kept for single-post drafting if needed
- `draftFromAngle` — kept, used internally by new batch flow
- `src/components/angle-composer.tsx` — left in place (safe to delete later, not urgent)
- All existing DB schema — no migrations needed for this feature
- The `generate()` / `generateStructured()` runner — unchanged

---

## 9. What does NOT get built (YAGNI)

- Video scripts — downstream of posts, not in this sprint
- Auto-posting — still human-in-the-loop
- Metrics tracking — separate spine
- Vault/Obsidian integration — no vault directory exists; `docs/HANDOFF.md` is sufficient
- Saved weekly plans in DB — out of scope; posts saved to `drafts` on copy/approve

---

## 10. Open hook: X algorithm skills

When Cisco's 10 X algorithm skills are complete, they plug into `buildAlgorithmRulesBlock(format)`. Expected input: format-specific rules like "experiment posts should end with a question", "quick-takes under 150 chars get more reach", "avoid external links in body". The stub is in place from day one.

---

## 11. Success criteria

- "Generate this week's posts" produces 5 posts, one per format, in under 5 minutes
- Each post passes a read-aloud test: sounds like a builder texting a peer, not a newsletter
- At least 2 of 5 posts reference something from the last 48h with a date/source
- At least 1 post references something from `docs/HANDOFF.md` (what Cisco is actually building)
- Zero AI tells in final output (no em dashes, no "game-changer", no newsletter openers)
- User can edit any post inline and copy with one click
