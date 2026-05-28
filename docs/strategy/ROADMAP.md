# Resonance — Strategy Roadmap

Each plan below is a one-session interview that produces a strategic document.
Pick one plan at a time. Answer the questions in `/compose` (or copy them into
a chat with Claude). The output becomes a living doc you reference when using
the engine.

Run order suggestion: 1 → 2 → 3 → 4 → 5. Plans 6–7 are ongoing.

---

## Plan 1 — Growth Strategy

**What it covers:** Why you're on X, who you want to reach, what "growth" means
to you (followers, leads, opportunities, reputation), your 6-month north star.

**Interview questions:**
1. What is the single outcome that would make X worth the time? (audience size, inbound leads, job offers, community, influence in a niche?)
2. Who specifically do you want to notice you? (founders, engineers, investors, potential collaborators — be specific about 2–3 archetypes)
3. What does your target reader currently follow, and what are they missing that you could provide?
4. What is your unfair advantage — what can you say that most people in your niche can't or won't?
5. What's your timeline horizon? (3 months, 6 months, 1 year) What would "on track" look like at the midpoint?

**Output:** `docs/strategy/growth-strategy.md` — a 1-page brief: north star,
target archetypes, your edge, 6-month milestone.

---

## Plan 2 — Content Mix

**What it covers:** What types of posts you should make, in what proportion,
for what purpose. Prevents defaulting to "whatever feels good" and drifting
off-niche.

**Interview questions:**
1. Look at your `voice_spec` pillars (e.g. interpretability, systems, tools). For each pillar: should it drive original posts, replies, or both?
2. What ratio feels right: original insights vs. reactions/replies vs. sharing others' work? (e.g. 60% originals, 30% replies, 10% reshares)
3. Are there topics you want to be known for that you currently under-post about?
4. Are there topics you currently engage with that you want to dial back?
5. What's the one post format that best fits your voice? (hot take, technical breakdown, data observation, personal story, question to the community)

**Output:** `docs/strategy/content-mix.md` — a simple table: pillar → post type →
target frequency, plus a "stay in lane" red list.

---

## Plan 3 — Reply Playbook

**What it covers:** How to turn replies into growth. Which accounts to target,
what kind of replies actually work, how to avoid looking spammy or sycophantic.

**Interview questions:**
1. From your seed accounts list, which 5–10 do you most want to be seen engaging with? Why those?
2. What makes a reply worth writing vs. skipping? (post topic, author reach, recency, whether you have something real to add)
3. What's your reply style — sharp + brief, technical + thorough, ask a question, share a counter-example?
4. Hard rules: what will you never reply with? (generic praise, "great point", self-promotion in replies)
5. When a reply goes semi-viral (>50 likes), what's your follow-up move?

**Output:** `docs/strategy/reply-playbook.md` — target account tier list, reply
decision criteria (yes/no checklist), style guide, hard rules.

---

## Plan 4 — Posting Frequency

**What it covers:** A sustainable weekly cadence that doesn't burn you out.
How many originals, how many replies, on which days/times.

**Interview questions:**
1. How many hours per week can you realistically spend on X content? (research + draft + review + post)
2. Do you want a fixed schedule (e.g. Mon/Wed/Fri) or post when inspired?
3. What time of day is your target audience most active? (if you don't know: engineers in the US tend to engage 9–11am ET, 3–5pm ET)
4. Minimum viable week: if you had 30 minutes, what would you always do? (e.g. 1 original + 3 replies)
5. Maximum: what's the most you'd ever post in a week before it feels like noise?

**Output:** `docs/strategy/posting-frequency.md` — weekly cadence template
(Mon–Sun grid), minimum vs. target vs. max, time-of-day guidance.

---

## Plan 5 — Metrics & Signals

**What it covers:** What to track, how to interpret it, when to adjust. You
can't read X analytics directly — this plan defines manual checkpoints.

**Interview questions:**
1. Which vanity metrics do you explicitly NOT want to optimize for? (follower count, impressions, likes in isolation)
2. What's a meaningful signal that a post worked? (replies from smart people, DMs, profile visits, new followers from a specific archetype)
3. How often will you do a review? (weekly, bi-weekly, monthly)
4. What would tell you a content pillar is underperforming and should be cut?
5. What would tell you a pillar is working and should be doubled down on?

**Output:** `docs/strategy/metrics.md` — a minimal tracking template
(copy-pasteable), what signals mean what, review cadence + trigger rules.

---

## Plan 6 — Monitoring (ongoing)

**What it covers:** Weekly habit to stay informed in your niche without
spending hours on X. What to scan, what to save, what to skip.

**Interview questions:**
1. Which 5–10 accounts are your "must-read" — if they post, you want to know?
2. Which topics/keywords should you follow for timely angles? (papers, repos, company announcements, debates)
3. How much time per day do you want to spend on passive monitoring? (5 min, 15 min, 30 min)
4. Where do you currently find out about relevant news? (newsletters, HN, X itself, Discord)
5. What's a recent piece of news/paper/event that you wished you'd caught earlier?

**Output:** `docs/strategy/monitoring.md` — a daily/weekly monitoring checklist,
source list, and "worth an angle" criteria.

---

## Plan 7 — Iteration Loop

**What it covers:** A lightweight monthly review process. What changed, what to
adjust in the other plans, how to keep the engine relevant over time.

**Interview questions:**
1. At the end of each month, which 3 questions should you always ask yourself about your X strategy?
2. What would trigger an emergency mid-month review? (something went viral, a controversy, a major shift in your niche)
3. How do you decide when a seed account is no longer worth following/engaging?
4. When should you add a new pillar vs. go deeper on existing ones?
5. How will you know when the strategy is "working" well enough that you stop tweaking and just execute?

**Output:** `docs/strategy/iteration-loop.md` — monthly review template,
trigger list for early reviews, graduation criteria ("stop tweaking, start executing").

---

## Current App Status

| Feature | Status | How to use |
|---|---|---|
| Onboarding / voice setup | **Works** | `/profiles` → "Set up voice" |
| Original post composer | **Works** | `/compose` → research angles → draft |
| Board / reply queue | **Broken** | Apify token empty; pipeline dead |
| AdsPower posting | Configured, untested | `/compose` → approve draft → post |

**To use the engine today:**
1. Ensure Docker + `npx supabase start` are running
2. `npm run dev`
3. Log in at `http://localhost:3000` via Mailpit magic link (`http://127.0.0.1:54324`)
4. Go to `/compose` — research angles for any of your 5 pillars → draft → copy out

**You do NOT need Compose (the feature) for the strategy plans above** — those are
interview questions you answer in a chat. Paste each plan's questions into a
conversation and work through them. Save the outputs to the paths listed above.

---

*Pick Plan 1 or Plan 3 first — growth strategy grounds everything; reply playbook
gives you the highest immediate ROI since replies = reach.*
