// Run next session with: Workflow({ scriptPath: "docs/superpowers/workflows/viewcreator-research.workflow.js" })
// Researches ViewCreator.ai (product/studio, tool catalog, pricing, MCP, company) and
// synthesizes a design-oriented brief for the dispatchAI -> multi-channel cockpit pivot.
export const meta = {
  name: 'viewcreator-research',
  description: 'Research ViewCreator.ai across product, tools, pricing, MCP, and company to inform a clone design',
  phases: [
    { title: 'Research', detail: 'parallel agents, one per facet of viewcreator.ai' },
    { title: 'Synthesize', detail: 'combine into a design-oriented brief' },
  ],
}

const FACETS = [
  {
    key: 'product-studio',
    prompt: `Research the product ViewCreator.ai (https://www.viewcreator.ai/). Use WebFetch on the homepage and any "studio", "how it works", "product", or "features" pages you can find, and WebSearch for "ViewCreator.ai studio how it works", "ViewCreator.ai review", "ViewCreator.ai demo".
Answer concretely:
1. What IS the product in one paragraph (an AI content-creation tool library? a studio? an agent platform?).
2. The "Studio" concept — what is it, what does the main UI/workflow look like, how does a user actually go from idea to finished content? Describe the step-by-step flow if you can find it.
3. What "agentic" means in their pitch — do AI agents run multi-step automations, or are these single-shot generators?
4. Navigation / information architecture: top-level sections (Pricing, Studio, MCP, Company, etc.).
Return plain text. Cite URLs. Flag anything you could not verify.`,
  },
  {
    key: 'tool-catalog',
    prompt: `Research ViewCreator.ai's tool/automation catalog. Use WebFetch on https://www.viewcreator.ai/ and any "tools" pages, and WebSearch for "ViewCreator.ai tools list", "ViewCreator YouTube X Instagram TikTok automation".
Answer:
1. Which social/content CHANNELS are covered (YouTube, X, Instagram, TikTok, Facebook, Google/SEO, video repurposing, others?).
2. For each channel, list the named tools and one line on what each does.
3. Which tools are LIVE now vs "coming soon".
4. Critically: do these tools just GENERATE text/drafts, or do they actually PUBLISH/POST to the platforms? Look hard for any mention of scheduling, posting, or platform API connections.
Return plain text. Cite URLs.`,
  },
  {
    key: 'pricing',
    prompt: `Research ViewCreator.ai pricing. WebFetch https://www.viewcreator.ai/pricing (try variations) and WebSearch "ViewCreator.ai pricing plans cost".
Answer: the tiers, monthly/annual prices, what limits each tier has (credits, tools, channels, seats), free tier existence, and what's gated behind paid. Note if it's bundled with BridgeMind. Return plain text with a clear tier breakdown. Cite URLs. Flag unverified numbers.`,
  },
  {
    key: 'mcp',
    prompt: `Research ViewCreator.ai's MCP (Model Context Protocol) offering. WebFetch any https://www.viewcreator.ai/mcp page and WebSearch "ViewCreator.ai MCP server", "ViewCreator MCP Claude".
Answer: Does ViewCreator expose an MCP server? What tools/capabilities does it expose to AI agents (Claude, Cursor, etc.)? How does a user connect it? What's the intended use? This is important — the person wants to understand how MCP fits a content tool. Return plain text. Cite URLs. If you can't confirm an MCP server exists, say so explicitly.`,
  },
  {
    key: 'company-positioning',
    prompt: `Research the company behind ViewCreator.ai and its market positioning. WebSearch "ViewCreator.ai BridgeMind", "BridgeMind Vibeathon vibe coding", "ViewCreator.ai company about", "ViewCreator alternatives competitors".
Answer:
1. Who builds it (BridgeMind?), the broader ecosystem (Vibeathon, "vibe coding"), and their philosophy ("agentic organization").
2. Target user (solo creators, marketing teams, agencies?).
3. Direct competitors (e.g. Buffer, Hootsuite, Typefully, Taplio, Jasper, Copy.ai, Hypefury) and how ViewCreator differs.
4. Notably: how does ViewCreator handle VOICE / brand consistency, and real-time/fresh data? Does it fetch live trends/news, or generate from the model's own knowledge?
Return plain text. Cite URLs.`,
  },
]

phase('Research')
const research = await parallel(
  FACETS.map((f) => () =>
    agent(f.prompt, { label: `research:${f.key}`, phase: 'Research', agentType: 'general-purpose' })
      .then((text) => ({ key: f.key, text }))
  )
)

phase('Synthesize')
const corpus = research.filter(Boolean).map((r) => `## ${r.key}\n${r.text}`).join('\n\n---\n\n')
const brief = await agent(
  `You are briefing a developer who wants to BUILD A PERSONAL CLONE of ViewCreator.ai, but focused on: posting QUALITY, VOICE-CONSISTENT content to multiple social channels, powered by fresh/real daily data, with the best AI skill picked per task. He already has a local Next.js app ("dispatchAI") with a voice-spec engine, web-research generation via the Claude CLI (free), and an X reply-opportunity finder.

Here is parallel research on ViewCreator.ai:

${corpus}

Produce a tight, design-oriented brief in markdown:
1. **What ViewCreator actually is** (2-3 sentences).
2. **The UX model worth copying** — the Studio + tool-grid pattern, navigation, how a click becomes content.
3. **Tool catalog** — channels x tools, compact table; mark live vs coming.
4. **Generation vs publishing** — does it actually POST, or just draft? (decisive for his "start posting everywhere" goal).
5. **Voice & data freshness** — how (if at all) it handles brand voice and live/real data. Contrast with dispatchAI's strengths.
6. **Pricing & MCP** — one line each.
7. **Gap analysis for HIS goal** — what ViewCreator does that dispatchAI lacks, what dispatchAI already does BETTER (voice, free generation, real research), and the 4-6 concrete capabilities a clone would need to add to "post quality content to every social with a real voice on fresh data." Include the likely API/integration list (per channel) and which are free vs paid.
Be concrete and skip filler. Flag anything the research couldn't verify.`,
  { label: 'synthesize', phase: 'Synthesize' }
)

return { brief, facetsCovered: research.filter(Boolean).map((r) => r.key) }
