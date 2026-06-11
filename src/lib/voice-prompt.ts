import { frameUntrusted, sanitizeForPrompt, UNTRUSTED_DATA_NOTICE } from "@/lib/generate/sanitize";

export interface VoiceProfile {
  handle: string;
  niche_description: string | null;
  voice_corpus: string[];
  voice_notes: string | null;
}

export function buildVoiceSystem(p: VoiceProfile): string {
  const examples = p.voice_corpus.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return [
    `You write X (Twitter) posts as the account ${p.handle}.`,
    `Niche: ${p.niche_description ?? "general"}.`,
    p.voice_notes ? `Style guardrails: ${p.voice_notes}` : "",
    `Match the voice of these example posts exactly — cadence, casing, vocabulary:`,
    examples,
    `Never use hashtags unless the examples do. Never fabricate facts. Output must fit in one tweet (<=280 chars).`,
  ].filter(Boolean).join("\n\n");
}

export function buildReplyPrompt(targetTweet: string): string {
  return `${UNTRUSTED_DATA_NOTICE}\n\nWrite a reply to the tweet below that adds genuine value (a take, a question, or data), in the account's voice:\n\n${frameUntrusted(targetTweet)}\n\nAlso suggest one visual that would strengthen the reply (a recommendation or an image-generation prompt), or omit if none fits.`;
}

export function buildOriginalPrompt(topic: string): string {
  return `${UNTRUSTED_DATA_NOTICE}\n\nWrite an original post about the topic below:\n\n${frameUntrusted(topic, 1000)}\n\nIn the account's voice. Also suggest one visual (recommendation or image prompt) that would strengthen it, or omit if none fits.`;
}

import type { Angle } from "@/lib/schemas";

export function buildVoiceSystemFromSpec(p: { handle: string; voice_spec: string | null }): string {
  return [
    `You write X (Twitter) posts as the account ${p.handle}.`,
    `Follow this brand-voice spec exactly:`,
    p.voice_spec ?? "(no voice spec yet — be clear, specific, and non-generic)",
    `Never use hashtags unless the spec says to. Never fabricate facts. Each post must be <=280 chars.`,
  ].join("\n\n");
}

export function buildSynthesisPrompt(a: {
  niche: string; goals: string; tone: string; doDont?: string; admired?: string;
}): string {
  return [
    `Synthesize a reusable X brand-voice spec from this onboarding interview.`,
    `Niche: ${sanitizeForPrompt(a.niche, 1000)}`,
    `Goals/audience: ${sanitizeForPrompt(a.goals, 1000)}`,
    `Desired tone/style: ${sanitizeForPrompt(a.tone, 1000)}`,
    a.doDont ? `Do/Don't: ${sanitizeForPrompt(a.doDont, 1000)}` : "",
    a.admired ? `Admired accounts: ${sanitizeForPrompt(a.admired, 500)}` : "",
    `Produce a concrete voiceSpec (casing, length, emoji/hashtag policy, cadence of ideas, what to avoid),`,
    `content pillars, seed accounts (@handles worth engaging in this niche, researched), and 2-3 sample posts in the voice.`,
    `Return exactly this JSON shape, where every array is an array of PLAIN STRINGS (not objects):`,
    `{"voiceSpec": "...", "contentPillars": ["..."], "seedAccounts": ["@handle"], "samplePosts": ["...", "..."]}`,
  ].filter(Boolean).join("\n");
}

export function buildAnglesPrompt(pillars: string[]): string {
  return [
    `Research the web for recent (last 7 days) developments across these niche pillars: ${pillars.map((p) => sanitizeForPrompt(p, 200)).join(", ")}.`,
    `Propose 3-5 distinct post angles. "experiment" = suggest a concrete thing to test and post about.`,
    `Write hooks as plain, direct sentences. No em dashes (—). No colons as drama. No "discover", "dive into", "explore", "game-changer", or hype words. Sound like a dev texting a peer, not a newsletter subject line.`,
    `Return exactly this JSON shape:`,
    `{"angles": [{"mode": "news-insight" | "experiment" | "build-in-public", "hook": "one line", "source": "https://..."}]}`,
    `("source" optional; include it when the angle is based on a web finding.)`,
  ].join("\n");
}

export function buildOriginalFromAnglePrompt(voiceSystem: string, angle: Angle): string {
  return [
    voiceSystem,
    ``,
    `Write an original X post for this angle (mode: ${angle.mode}): "${sanitizeForPrompt(angle.hook, 500)}".`,
    angle.source ? `Source: ${sanitizeForPrompt(angle.source, 500)}` : "",
    `Informative and specific. No generic filler. 1 post, or 2-5 for a short thread only if it genuinely needs it; each <=280 chars.`,
    `Capitalization: capitalize the first word of each sentence and each new line. Keep everything else lowercase except proper nouns, model names, repo names, and acronyms.`,
    `Anti-AI-tell rules: no em dashes (—), no "delve", "dive into", "explore", "tapestry", "game-changer", "revolutionary", "it's worth noting", "in conclusion". No rhetorical questions as hooks. Write like a human dev texting a peer — concrete, no performance.`,
    `Return exactly this JSON shape (posts is an array of plain strings):`,
    `{"posts": ["..."], "suggestedVisual": "..."}  ("suggestedVisual" optional.)`,
  ].filter(Boolean).join("\n");
}

import type { WeeklyAngle } from "@/lib/schemas";

export function buildCiscoContextBlock(
  profile: { handle: string; voice_spec: string | null; content_pillars: string[] },
  handoffText: string,
  journalEntry?: string
): string {
  return [
    `You are generating content for ${profile.handle}.`,
    `Voice spec: ${profile.voice_spec ?? "(none yet — be lowercase, concrete, first-person)"}`,
    `Content pillars: ${profile.content_pillars.join(", ")}`,
    `Current projects and context:\n${handoffText}`,
    journalEntry ? `What ${profile.handle} is working on this week: ${journalEntry}` : "",
  ].filter(Boolean).join("\n\n");
}

export function buildWorldResearchPrompt(thread: "x-topics" | "github" | "news", date: string): string {
  if (thread === "x-topics") {
    return `Search X/Twitter for the most discussed topics in AI, developer tools, and crypto right now. Today is ${date}. Only include posts from the last 48 hours — skip anything older. For each topic give: the subject, approximate engagement level (viral/high/medium), 1-2 representative post excerpts, and the date. Return 3-5 topics as plain text.`;
  }
  if (thread === "github") {
    return `Fetch https://github.com/trending and https://github.com/trending?since=weekly. Today is ${date}. Filter for repos related to: AI tools, agentic workflows, LLMs, developer infrastructure, crypto/web3 tooling. For each relevant repo give: name, star count, one-sentence description, and why a builder in AI/agentic/crypto might care. Return 3-5 repos as plain text.`;
  }
  return `Search for major tech announcements, model releases, pricing changes, and developer-relevant news from the last 48 hours. Today is ${date}. Focus on: Anthropic, OpenAI, AI tooling, developer infrastructure, crypto/web3. For each item give: headline, date, source URL, and a one-sentence summary. Return 3-5 items as plain text.`;
}

export function buildCrossRefSynthesisPrompt(
  ciscoContext: string,
  research: { xTopics: string; github: string; news: string },
  date: string
): string {
  return [
    ciscoContext,
    `---`,
    `Today is ${date}. Here is what is happening in the world right now:`,
    `X/Twitter hot topics:\n${research.xTopics}`,
    `GitHub trending:\n${research.github}`,
    `Tech news:\n${research.news}`,
    `---`,
    `Find 3-5 post angles for this week. One per format: quick-take, experiment, tool-find, observation, reaction.`,
    `Rules:`,
    `- Only propose an angle if the connection to this person is real, not forced.`,
    `- For "reaction": only include if this person directly uses or has experience with the thing discussed. Skip and add a second "observation" if not.`,
    `- For "tool-find": only include if a GitHub repo genuinely overlaps their work.`,
    `- Never pad to hit 5 — 3 strong angles beats 5 weak ones.`,
    `Return exactly this JSON shape:`,
    `{"angles": [{"format": "quick-take"|"experiment"|"tool-find"|"observation"|"reaction", "hook": "one line", "connection": "why this fits this person specifically", "source": "https://..." (optional), "sourceDate": "May 27, 2026" (optional)}]}`,
  ].filter(Boolean).join("\n\n");
}

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  "quick-take": `Write a quick-take post. 1-3 sentences max. No setup. State the opinion directly. Under 200 chars preferred.`,
  "experiment": `Write an experiment post. Structure: what I tried → what happened → what I learned. 4-8 sentences, one per line. End with one genuine question that invites replies ("anyone else hit this?" or "what do you use for X?").`,
  "tool-find": `Write a tool-find post about this repo/tool. Structure: what it is (one sentence) → what I find interesting about it specifically → what I'd use it for. 3-5 sentences. Must reference my specific context, not generic "useful for developers".`,
  "observation": `Write an observation post. Pattern I've noticed while building → what it means → my take. Use confident labeling ("that's not a coincidence, that's X"). Qualify honestly before the punch. Use a pivot question ("but for [your audience]?") to reframe if it fits. 4-8 sentences, one per line.`,
  "reaction": `Write a reaction post. Structure: before state → trigger/event → now state → numbers/proof if available. Narrative arc, one sentence per line. Suggest a suggestedVisual if there is a screenshot or metric I could attach.`,
};

export function buildWeeklyDraftPrompt(
  voiceSystem: string,
  angle: Pick<WeeklyAngle, "format" | "hook" | "source" | "sourceDate">,
  algorithmRules: string
): string {
  return [
    voiceSystem,
    `Write a post for this angle (format: ${angle.format}): "${sanitizeForPrompt(angle.hook, 500)}"`,
    angle.source ? `Source: ${sanitizeForPrompt(angle.source, 500)}${angle.sourceDate ? ` (${sanitizeForPrompt(angle.sourceDate, 100)})` : ""}` : "",
    FORMAT_INSTRUCTIONS[angle.format] ?? "",
    algorithmRules,
    `Anti-AI-tell rules: no em dashes (—), no "delve", "game-changer", "revolutionary", "it's worth noting", "in conclusion". No rhetorical questions as hooks. Write like a builder texting a peer.`,
    `Voice rules: lowercase sentence starts. first-person ("I ran X" not "X has been shown to"). one sentence per line for multi-line posts. specific over vague — name the tool, the number, the date. real numbers when available. max 1 emoji, only if genuinely earned.`,
    `Return exactly this JSON: {"posts": ["..."], "suggestedVisual": "..."} (suggestedVisual optional.)`,
  ].filter(Boolean).join("\n\n");
}

const ALGORITHM_BASE = `2026 X algorithm rules (must be respected):
- Replies > reposts > likes for distribution — write so people reply, not just like
- Links in post body suppress reach — if you must cite a URL, put it in a reply-to-yourself
- First line is the entire bet: passes the 3-second scroll test or the post dies
- Out-of-network reach chain: saves → profile-clicks → follows; every "save-worthy" element matters
- Specific numbers, tool names, and dates outperform vague claims in saves + shares
- Never end with generic CTAs ("follow me", "share this"); end with a real question if at all`;

const ALGORITHM_BY_FORMAT: Record<string, string> = {
  "quick-take": `Format-specific: under 200 chars is ideal — no links, state the opinion, invite challenge.`,
  "experiment": `Format-specific: metrics and concrete outcomes drive shares; include at least one number.`,
  "tool-find": `Format-specific: put the repo URL in a reply, not the post body. Mention a specific capability, not just the name.`,
  "observation": `Format-specific: end with a quotable one-liner — this is what gets saved and screenshot-shared.`,
  "reaction": `Format-specific: use a screenshot/metric as the visual anchor if available; describe it in the suggestedVisual field.`,
  "thread": `Format-specific: first tweet must work standalone — never "a thread:" opener. Saves on tweet 1 are the distribution mechanism.`,
  "reply": `Format-specific: standalone value beats agreement — add a fact the original post didn't have or it's noise.`,
};

export function buildAlgorithmRulesBlock(format: string): string {
  const specific = ALGORITHM_BY_FORMAT[format] ?? "";
  return [ALGORITHM_BASE, specific].filter(Boolean).join("\n");
}

export function buildAlgorithmReplyRulesBlock(): string {
  return [ALGORITHM_BASE, ALGORITHM_BY_FORMAT["reply"]].join("\n");
}

export function buildThreadPrompt(voiceSystem: string, topic: string, algorithmRules: string): string {
  return [
    voiceSystem,
    UNTRUSTED_DATA_NOTICE,
    `Draft a Twitter thread on the topic below:\n${frameUntrusted(topic, 1000)}`,
    `Thread rules:`,
    `- 5-8 tweets total. If the content is genuinely thin (can be said in one tweet), set thin=true and give a single-tweet alternative in thin_suggestion.`,
    `- Tweet 1 (type "hook"): works as a standalone tweet. NO "a thread:" or 🧵 opener. The first tweet is the only one most people see — make it the full payoff, not a teaser.`,
    `- Body tweets (type "body"): one idea per tweet. Specific and concrete. Name the tool, the number, the date.`,
    `- Final tweet (type "cta"): a genuine question or invitation. Not "follow me for more".`,
    `- Capitalization: capitalize first word + proper nouns only. No hashtags.`,
    `- Anti-AI-tell: no em dashes, no "delve", "game-changer", "revolutionary". Sound like a builder texting a peer.`,
    algorithmRules,
    `Return exactly this JSON:`,
    `{"tweets": [{"tweet": "...", "type": "hook"|"body"|"cta"}], "thin": false, "thin_suggestion": null}`,
  ].filter(Boolean).join("\n\n");
}

export function buildTrendRadarPrompt(pillars: string[], date: string): string {
  return [
    `Search X/Twitter, tech news, and GitHub for concrete trends relevant to these content pillars: ${pillars.map((p) => sanitizeForPrompt(p, 200)).join(", ")}.`,
    `Today is ${date}. Focus on signal from the last 48 hours only — skip evergreen topics.`,
    `Find 2-3 real, specific trends. Each must have a "why_now": what actually changed this week (a release, an announcement, a spike in discussion).`,
    `For each trend propose one concrete post angle — a specific thing a builder in this space could say from their own experience.`,
    `Avoid generic noise ("AI is growing", "crypto is volatile"). Only surface things that would make someone say "I need to post about this today".`,
    `Return exactly this JSON:`,
    `{"trends": [{"topic": "...", "why_now": "...", "angle": "...", "source": "https://... (optional)"}], "generatedAt": "${date}"}`,
  ].join("\n");
}

export interface WarehouseTweetLine {
  handle: string;
  text: string;
  url: string;
  createdAt: string | null;
}

/**
 * P2 topic board prompt: the LLM RANKS against our own scraped signal instead of
 * discovering blind. Dated sources are mandatory — schema rejects sourceless output.
 */
export function buildTopicBoardPrompt(
  pillars: string[],
  date: string,
  warehouseTweets: WarehouseTweetLine[],
): string {
  const lines = [
    `Search X/Twitter, tech news, and GitHub for concrete trends relevant to these content pillars: ${pillars.map((p) => sanitizeForPrompt(p, 200)).join(", ")}.`,
    `Today is ${date}. Focus on signal from the last 48 hours only — skip evergreen topics.`,
  ];
  if (warehouseTweets.length > 0) {
    lines.push(
      `These high-velocity tweets come from our own signal warehouse (scraped in the last 48h). Treat them as ground truth for what is ACTUALLY moving — prefer topics corroborated by them, and rank harder evidence above vibes:`,
      ...warehouseTweets.map(
        (t) => `- @${sanitizeForPrompt(t.handle, 40)} (${t.createdAt ?? "unknown time"}): ${sanitizeForPrompt(t.text, 200)} [${t.url}]`,
      ),
    );
  }
  lines.push(
    `Find 2-6 real, specific topics. Each must have a "why_now": what actually changed this week (a release, an announcement, a spike in discussion).`,
    `For each topic propose one concrete post angle — a specific thing a builder in this space could say from their own experience.`,
    `Classify each topic's "kind": "spike" (reaction window measured in hours) or "durable" (conversation with days of legs).`,
    `Every topic MUST cite at least one real source with a URL and its publication date — no source, no topic. Never invent URLs or dates.`,
    `Avoid generic noise ("AI is growing"). Only surface things that would make someone say "I need to post about this today".`,
    `Return exactly this JSON:`,
    `{"topics": [{"topic": "...", "why_now": "...", "angle": "...", "kind": "spike|durable", "sources": [{"url": "https://...", "title": "...", "published_at": "ISO date or human date"}]}], "generatedAt": "${date}"}`,
  );
  return lines.join("\n");
}

export function buildTargetFinderPrompt(
  seedHandles: string[],
  pillars: string[],
  northStarMetric: string | null,
  date: string
): string {
  const safePillars = pillars.map((p) => sanitizeForPrompt(p, 200)).join(", ");
  const safeHandles = seedHandles.slice(0, 20).map((h) => sanitizeForPrompt(h, 100)).join(", ");
  return [
    `Today is ${date}. I want to grow my X/Twitter account in these niches: ${safePillars}.`,
    northStarMetric ? `North-star metric: ${sanitizeForPrompt(northStarMetric, 300)}` : "",
    seedHandles.length > 0
      ? `My current seed accounts: ${safeHandles}`
      : "I don't have seed accounts yet.",
    `Find 5-10 X/Twitter accounts I should prioritize engaging with right now. These should be:`,
    `- Active in my niche (posting regularly, getting real engagement)`,
    `- A mix of: larger accounts (10k+) I can add signal to, and peers (1k-10k) I can build relationships with`,
    `- NOT already in my seed list above`,
    `- Real accounts (no bots, no spam)`,
    `For each, explain why engaging with them helps my specific north-star metric, and suggest a concrete approach (type of reply, what kind of value to add).`,
    `Rank by expected impact: "high" = direct path to my north-star, "medium" = indirect, "low" = brand-building only.`,
    `Return exactly this JSON:`,
    `{"targets": [{"handle": "@handle", "reason": "...", "priority": "high"|"medium"|"low", "suggested_approach": "..."}], "generatedAt": "${date}"}`,
  ].filter(Boolean).join("\n");
}

export function buildBreakoutPrompt(draft: string): string {
  return [
    `Score this X/Twitter post for out-of-network breakout potential on a 1-7 scale.`,
    `2026 X algorithm breakout criteria:`,
    `- Hook (first line): stops the scroll in 3 seconds, or the post is invisible`,
    `- Save-worthiness: specific enough to bookmark — numbers, tool names, contrarian takes, quotable one-liners`,
    `- Links in post body: -2 penalty (suppressed by algo); links belong in replies`,
    `- Specificity: names + numbers outperform generalities for shares`,
    `- Reply-bait: ends with a real question or claim that invites push-back`,
    `Score rubric:`,
    `1-2: Generic noise — would not stop a scroll, no reason to save`,
    `3-4: In-network only — your followers see it, nobody else`,
    `5-6: Breakout candidate — hook is arresting, content is specific enough to share`,
    `7: High-confidence breakout — hook + save-worthy + reply-bait all firing`,
    `Post to score:\n"""\n${draft}\n"""`,
    `Return exactly this JSON:`,
    `{"score": 5, "verdict": "one sentence", "hook_strength": "strong"|"medium"|"weak", "fixes": ["specific fix 1", "specific fix 2"]}`,
  ].join("\n");
}

export function buildSeedScanPrompt(handles: string[], date: string): string {
  const safeHandles = handles.map((h) => sanitizeForPrompt(h, 100));
  return [
    `Search X/Twitter for recent posts from these accounts: ${safeHandles.join(", ")}.`,
    `Today is ${date}. Only include posts from the last 24 hours — skip anything older.`,
    `For each post found, give: author handle, the post text, approximate like count, post date/time, and post URL if available.`,
    `Focus on posts that ask questions, make technical claims, share data, or make statements that a builder in AI/dev/crypto could add genuine technical information to.`,
    `Return as plain text, one post per section.`,
  ].join("\n");
}

export function buildReplyFilterPrompt(scannedPosts: string, ciscoContext: string): string {
  return [
    ciscoContext,
    `---`,
    UNTRUSTED_DATA_NOTICE,
    `Here are recent posts from seed accounts:\n${frameUntrusted(scannedPosts, 8000)}`,
    `---`,
    `Select 3-5 posts worth replying to. A post is worth replying to if:`,
    `1. This person has direct technical knowledge about the topic`,
    `2. The reply would add information the original post did not have`,
    `3. The post has engagement potential (asking a question, making a claim, inviting discussion)`,
    `4. The post is recent (less than 24h old)`,
    `Skip posts that are: pure reshares, opinions with no technical hook, or topics this person has no specific knowledge about.`,
    `Return exactly this JSON:`,
    `{"opportunities": [{"targetHandle": "@handle", "targetPost": "the post text", "targetUrl": "url or empty string", "targetLikes": 0, "postedAt": "date string", "reason": "one sentence: why reply here"}]}`,
  ].filter(Boolean).join("\n\n");
}

export function buildReplyDraftPrompt(
  voiceSystem: string,
  opportunity: { targetHandle: string; targetPost: string; reason: string }
): string {
  return [
    voiceSystem,
    UNTRUSTED_DATA_NOTICE,
    `Draft a reply to this post by ${sanitizeForPrompt(opportunity.targetHandle, 100)}:\n${frameUntrusted(opportunity.targetPost)}`,
    `Reply rules:`,
    `- Start with the core technical fact. No "great question", no wind-up, no restating what they said.`,
    `- Second sentence explains the implication of that fact, or gives a contrast.`,
    `- Stop at 2-4 sentences. Do not list multiple reasons.`,
    `- If you have nothing genuinely technical or specific to add, return {"skip": true} instead.`,
    `- Never sycophantic openers. Never summarize the original post. Add information it did not have.`,
    `Return exactly this JSON: {"reply": "...", "skip": false} or {"skip": true}`,
  ].filter(Boolean).join("\n\n");
}
