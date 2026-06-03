# X / Social Growth Playbook — Research Grounding (2026-06-01)

Grounding for Embalio's engagement engine. Captured during the quiz-as-plan
brainstorm so the playbook is sourced, not vibes. Sources inline.

## The signal that reframes the product

X open-sourced its ranker and (Sept 2025) disclosed predicted-engagement weights.
Relative to a Like (baseline 0.5):

| Action | Weight | ≈ vs Like |
|---|---|---|
| You reply AND the author replies back | **+75** | **~150×** |
| You reply to the post | +13.5 | ~27× |
| Profile click → then like/reply | +12 | ~24× |
| Open conversation → reply/like | +11 | ~22× |
| Dwell ≥2 min | +10 | ~20× |
| Bookmark | +10 | ~20× |
| Repost | +1 | ~2× |
| Like | +0.5 | 1× |

**Implication:** the supreme objective is getting the *original author to reply
back* (+75). Every drafted reply should be engineered to make the OP respond —
not to farm likes. Replies (~27×) >> reposts (~2×) >> likes. Bookmarks & dwell
(~20×) reward "save-worthy" + longer dwell content.
Sources: Social Media Today (X disclosure), PostEverywhere, github.com/xai-org/x-algorithm.

## Replies are the growth engine (70/30)

~70% effort on strategic replies, 30% original — while small. A strong reply on a
larger account borrows their audience → profile click (+12) → follow.

**Targeting logic (encode this):**
- Author size **5–20× your followers** (mega buries you; tiny has no audience).
- Reply **<30 min after posting** (ideally <5 min); skip stale.
- Post has **<20 replies** (stay in visible top 10–20).
- Rising/momentum, in-niche, genuine expertise only.
- Volume guardrails: ~15–20 quality replies/day, <50/day. Deboost triggers: 20+/hr,
  copy-paste replies, 3–4+ to same account/day, links in replies. (vendor figures — directional)
Sources: Teract, Nerdbot, Agile Luminary.

## Anti-slop reply playbook (by scenario)

Universal: standalone value, specific (number/example), concise (1–2 sentences),
earn the profile click. **Never:** "great post", "this 🔥", "well said", bare emoji,
restating their point — pure slop, zero reach, bot-like at scale.

- **Supportive/additive:** affirm in half a sentence, then add a data point/mechanism/example they didn't have.
- **Contrarian:** disagree on substance with evidence, stay warm ("opposite in our data: …"). Pulls the +75 author reply. Never dunk (Grok flags toxic tone → mutes/blocks damage account reputation).
- **Humorous:** one sharp *on-topic* line that reframes the post (rewards people who read it). No generic memes.
- **Technical:** the precise practitioner detail/gotcha/number. Best profile-click driver in technical niches.
- **Question:** a *specific* question proving you read it, that the author enjoys answering → maximizes +75. Never "thoughts?".

## Original posts (create-a-post grounding)

- **Hook = line 1** (out-of-network sees only that): curiosity gap + specific payoff. Templates: contrarian ("everyone says X, it's wrong, here's what worked"), specific-outcome+mystery, confession+pivot, numbered promise, question hook.
- **Format:** text is strong on X (reportedly > video); **threads 5–10 (~7)** when there's a real sequence (~63% more impressions); **screenshots > links**; **link-in-reply** (default no link in main post — penalty maybe removed Oct 2025 but link-in-reply is safe either way).
- **Length:** ~71–100 chars max quick replies; ~240–259 max likes. Avoid the mushy middle.
- **Cadence/timing:** 3–5 posts/day; Tue/Wed/Thu ~9am–3pm; Tue 9–10am top.
- **Newsjack** hot topics *early*, with a genuine take.
- Optimize for replies/bookmarks/dwell, not likes.
Sources: PostEverywhere, Ship30for30, Buffer, Sprout Social, Watsspace.

## Cross-platform (tune per platform)

- **X:** fast, short half-life (hour 1), high volume, reply is the unit, text wins, conversation depth supreme, witty-contrarian tolerated.
- **LinkedIn:** slower; **comments ~15× likes, comments >15 words ~2×**; substantive long comments + consistent cadence win; engagement bait & pods penalized; no 0.3s hook pressure.
- **YouTube:** comments are a recommendation signal; first 2–4h velocity; **pinned-comment prompts (~+30% replies)** and selective **creator hearts (~+20% comments)**; reply fast & on-topic.
Sources: Meet-Lea, Hootsuite, AIR Media-Tech, CommentShark, ACM CHI 2025 (Creator Hearts).

## How accounts actually grew (patterns)

Build-in-public transparency + verifiable proof (MRR screenshots) + repeatable
weekly/monthly cadence + borrowing a bigger audience (influencer equity, co-hosted
Spaces, strategic replies). Crypto: Spaces + micro-KOLs + practitioner credibility
(separate transferable credibility tactics from paid shilling). None grew on generic
motivational content.
Sources: Indie Hackers (Tweet Hunter, Pika), DirectoryGems (TrustMRR), TheKollab, CoinDesk.

## Flagged uncertainties
- External-link penalty: sources conflict; possibly removed Oct 2025 → use link-in-reply regardless.
- Premium boost multipliers: no official number.
- Reply-volume/deboost thresholds + conversion stats: single-vendor, directional only.
- "Text beats video on X": third-party, X-specific, contradicts general norms.
