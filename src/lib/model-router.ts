/**
 * model-router.ts — Canonical source
 * Lives in: cisco-brain/40 - RESOURCES/AI Routing/
 * Copy to:  organic-app/lib/ai/model-router.ts
 *           linden/src/lib/model-router.ts
 *
 * When routing logic changes: update this file, re-copy to each project.
 * When new models ship: update the MODELS block only — nothing else changes.
 *
 * Decision framework: AI Model Routing — Decision Framework (2026-05-18).md
 */

export type TaskType =
  | 'reasoning'         // architecture, complex debugging, multi-step analysis
  | 'coding'            // write/edit code, implement features, refactors
  | 'structured_output' // JSON extraction, classification, field mapping, tool-use chains
  | 'creative'          // brand voice, copywriting, positioning, content
  | 'retrieval'         // summarise docs, Q&A over documents, sprint recaps
  | 'bulk'              // high-volume, repetitive, low-stakes batch work

export type CostTier = 'economy' | 'standard' | 'premium'
export type Provider = 'anthropic' | 'openai'

// Effort controls reasoning depth via output_config.effort on the Anthropic API.
// Fable 5 + Opus 4.8:  low | medium | high | xhigh | max
// Sonnet 4.6:           low | medium | high | max  (no xhigh)
// Haiku 4.5:            not supported — errors if set
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface RouteConfig {
  taskType: TaskType
  costTier?: CostTier     // default: 'standard'
  effort?: EffortLevel    // default per-model; only applies to Fable 5 / Opus 4.8 / Sonnet 4.6
  requiresTools?: boolean // true → nudges toward OpenAI for parallel tool-use chains
}

export interface ModelRoute {
  provider: Provider
  model: string
  rationale: string      // loggable "why" — feed to Agentic OS explainability layer
  effort?: EffortLevel   // output_config.effort for Anthropic models (omit = model default)
}

// ─── Model constants ──────────────────────────────────────────────────────────
// Update strings here when new models ship. Nothing else needs to change.

const MODELS = {
  anthropic: {
    fable:  'claude-fable-5',
    opus:   'claude-opus-4-8',
    sonnet: 'claude-sonnet-4-6',
    haiku:  'claude-haiku-4-5-20251001',
  },
  openai: {
    frontier: 'gpt-5.5',
    standard: 'gpt-4.1',
    mini:     'gpt-4.1-mini',
  },
} as const

// ─── Routing table ────────────────────────────────────────────────────────────
// Signal 1 (task type) + Signal 2 (capability match) combined.
// effort is the default for this task type; overridden by effort= in RouteConfig.

const ROUTING_TABLE: Record<TaskType, ModelRoute> = {
  reasoning: {
    provider: 'anthropic',
    model: MODELS.anthropic.fable,
    rationale: 'Fable 5 low effort — Opus-class quality, credit-efficient for general reasoning',
    effort: 'low',
  },
  coding: {
    provider: 'anthropic',
    model: MODELS.anthropic.sonnet,
    rationale: 'Sonnet 4.6 — best coding/cost ratio, Claude Code default',
  },
  structured_output: {
    provider: 'openai',
    model: MODELS.openai.standard,
    rationale: 'GPT-4.1 — stronger JSON mode + parallel function-call reliability',
  },
  creative: {
    provider: 'anthropic',
    model: MODELS.anthropic.opus,
    rationale: "Opus 4.8 — Claude's writing voice is clearly superior for brand/content",
  },
  retrieval: {
    provider: 'anthropic',
    model: MODELS.anthropic.sonnet,
    rationale: 'Sonnet 4.6 — 1M context, consistent summaries, best quality/cost for doc Q&A',
  },
  bulk: {
    provider: 'anthropic',
    model: MODELS.anthropic.haiku,
    rationale: 'Haiku 4.5 — fastest + cheapest, sufficient quality for batch work',
  },
}

// ─── Cost tier overrides ──────────────────────────────────────────────────────
// Signal 3: override the capability-matched model with a cheaper or better one.

const ECONOMY: Record<Provider, string> = {
  anthropic: MODELS.anthropic.haiku,
  openai:    MODELS.openai.mini,
}

const PREMIUM: Record<Provider, string> = {
  anthropic: MODELS.anthropic.fable,
  openai:    MODELS.openai.frontier,
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function routeModel(config: RouteConfig): ModelRoute {
  const base = { ...ROUTING_TABLE[config.taskType] }

  // requiresTools nudge: prefer OpenAI for complex parallel tool-use chains
  if (config.requiresTools && config.taskType === 'structured_output') {
    base.provider = 'openai'
    base.model = MODELS.openai.standard
    base.rationale += ' (tools nudge: OpenAI preferred for parallel function calling)'
  }

  // Cost tier overrides (Signal 3) — effort ignored when tier overrides model
  if (config.costTier === 'economy') {
    return {
      provider: base.provider,
      model: ECONOMY[base.provider],
      rationale: `Economy tier → ${ECONOMY[base.provider]} (downgraded from ${base.model})`,
    }
  }

  if (config.costTier === 'premium') {
    if (base.provider === 'anthropic') {
      return {
        provider: 'anthropic',
        model: MODELS.anthropic.fable,
        rationale: `Premium tier → Fable 5 medium effort (credit-capped maximum)`,
        effort: 'medium',
      }
    }
    return {
      provider: base.provider,
      model: PREMIUM[base.provider],
      rationale: `Premium tier → ${PREMIUM[base.provider]} forced`,
    }
  }

  // Effort override — adjusts effort without changing model
  if (config.effort !== undefined) {
    base.effort = config.effort
    base.rationale += ` [effort=${config.effort}]`
  }

  return base
}

// ─── Convenience shortcuts ────────────────────────────────────────────────────
// Use these in application code for cleaner call sites.

export const route = {
  // General reasoning — Fable 5 medium effort
  reasoning:        ()                      => routeModel({ taskType: 'reasoning' }),
  // Architecture / planning / hard debug — Fable 5 medium (credit-capped max)
  architecture:     ()                      => routeModel({ taskType: 'reasoning', effort: 'medium' }),
  // Maximum quality — Fable 5 medium (credit-capped maximum; xhigh/max not used)
  deepThink:        ()                      => routeModel({ taskType: 'reasoning', costTier: 'premium' }),
  // Fable 5 with explicit effort control
  fable:            (effort: EffortLevel = 'medium') => ({
    provider: 'anthropic' as Provider,
    model: MODELS.anthropic.fable,
    rationale: `Fable 5 direct [effort=${effort}]`,
    effort,
  }),
  // Opus 4.8 with explicit effort control (xhigh for hardest problems)
  opus:             (effort: EffortLevel = 'high') => ({
    provider: 'anthropic' as Provider,
    model: MODELS.anthropic.opus,
    rationale: `Opus 4.8 direct [effort=${effort}]`,
    effort,
  }),
  coding:           ()                      => routeModel({ taskType: 'coding' }),
  structuredOutput: (requiresTools = false) => routeModel({ taskType: 'structured_output', requiresTools }),
  creative:         ()                      => routeModel({ taskType: 'creative' }),
  retrieval:        ()                      => routeModel({ taskType: 'retrieval' }),
  bulk:             ()                      => routeModel({ taskType: 'bulk' }),
  cheap:  (taskType: TaskType)              => routeModel({ taskType, costTier: 'economy' }),
  premium: (taskType: TaskType)             => routeModel({ taskType, costTier: 'premium' }),
}

// ─── SDK helper — build Anthropic messages.create params ─────────────────────
// Generates the correct API surface for each model tier.
//
// Fable 5:   omit `thinking` entirely (always-on; explicit config 400s)
//            use `output_config: {effort}` to control depth
// Opus 4.8:  `thinking: {type: "adaptive"}` + `output_config: {effort}`
// Sonnet 4.6: `thinking: {type: "adaptive"}` + `output_config: {effort}` (optional)
// Haiku 4.5: neither (errors if set)
//
// NOTE: `thinking: {type: "enabled", budget_tokens: N}` is REMOVED on all 4.7+ models.

export function toAnthropicParams(r: ModelRoute, maxTokens = 8192) {
  const params: Record<string, unknown> = { model: r.model, max_tokens: maxTokens }

  const isFable  = r.model === MODELS.anthropic.fable
  const isOpus   = r.model === MODELS.anthropic.opus
  const isSonnet = r.model === MODELS.anthropic.sonnet

  if (r.effort && (isFable || isOpus || isSonnet)) {
    params.output_config = { effort: r.effort }
    // Fable 5: omit thinking param (always-on, explicit config 400s)
    // Opus 4.8 / Sonnet 4.6: adaptive thinking required alongside effort
    if (isOpus || isSonnet) {
      params.thinking = { type: 'adaptive' }
    }
  }

  return params
}

// ─── Usage examples ───────────────────────────────────────────────────────────
/*
import { route, routeModel, toAnthropicParams } from '@/lib/ai/model-router'

// Standard shortcuts
route.coding()           // → Sonnet 4.6, no effort
route.reasoning()        // → Fable 5, effort=medium
route.architecture()     // → Fable 5, effort=xhigh (deep architecture thinking)
route.deepThink()        // → Fable 5 premium, effort=xhigh (hardest problems)
route.fable('low')       // → Fable 5, effort=low (fast, still Opus-class)
route.opus('xhigh')      // → Opus 4.8, effort=xhigh (maximum Opus depth)

// Explicit effort on any reasoning call
routeModel({ taskType: 'reasoning', effort: 'high' })   // Fable 5 effort=high
routeModel({ taskType: 'reasoning', effort: 'xhigh' })  // Fable 5 effort=xhigh

// Build Anthropic SDK params
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic()

// Fable 5 medium — generates: { model, max_tokens, output_config: {effort: "medium"} }
const r = route.reasoning()
const response = await client.messages.create({
  ...toAnthropicParams(r),
  messages: [{ role: 'user', content: 'Design the auth system' }],
})

// Opus 4.8 xhigh — generates: { model, max_tokens, thinking: {type:"adaptive"}, output_config: {effort:"xhigh"} }
const deep = route.opus('xhigh')
const response2 = await client.messages.create({
  ...toAnthropicParams(deep, 16384),
  messages: [{ role: 'user', content: 'Debug this race condition...' }],
})

// OpenAI (no thinking config needed)
import OpenAI from 'openai'
const openai = new OpenAI()
const { model } = route.structuredOutput()
const response3 = await openai.chat.completions.create({ model, messages: [...] })
*/
