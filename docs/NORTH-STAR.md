# Resonance — North Star

**Last updated:** 2026-05-30
**Status:** Direction locked; Stage 1 ("Pulse") in build.

This is the long-term architecture + roadmap. It is intentionally short. Read
`docs/HANDOFF.md` for current point-in-time state. When the direction changes,
edit this file — don't fork it.

---

## 1. Vision

A personal **growth-hacking engine for X** that:

- constantly scans your niche and **pings you (on your phone) with high-value
  reply opportunities — each with a ready-to-post comment already written**,
- drafts your own posts in your voice,
- tracks the numbers that matter (reach, quality, scores, plan progress),

so you compound your presence in a niche with minimal friction. Used by **one
owner with multiple X accounts today**, and built to become a **multi-user
product** later — without a rewrite.

Non-goals (for now): native iOS/Android app (Telegram is the phone client),
auto-posting without human approval (always human-in-the-loop).

---

## 2. The core constraint that shapes everything

All generation today shells `claude -p` — **free, Opus-quality, but only runs on
the owner's Mac.** It cannot run on a server, cannot serve a phone-while-away
when the Mac is off, and cannot serve other users.

> **Therefore:** anything that must be always-on or multi-user requires
> **cloud generation** (Claude API / AI Gateway — paid per token). The free CLI
> is a local-dev engine, not a product engine. We design so the swap is a config
> change, not a rewrite — `GEN_BACKEND` already abstracts this.

---

## 3. Staged architecture (one codebase)

| | **Stage 1 — Now (owner, free)** | **Stage 2 — Product (later, paid)** |
|---|---|---|
| Engine | `claude -p` (local) | Claude API / AI Gateway |
| Host | local scheduler (Mac on) | Vercel crons (always-on) |
| Notifications | Telegram bot → owner's phone | Telegram bot (hosted, per-user) |
| Tenancy | owner's accounts | many users × many accounts |
| Isolation | single-user | Supabase RLS per user (in progress) |
| Cost | $0 | tokens, covered by subscription pricing |

The product is the same scan → score → draft → notify → track pipeline and the
same Telegram UX. **Stage 2 swaps the engine + host, not the product.**

---

## 4. Data model (already multi-account-shaped)

- `profiles` — an **X account** (handle, voice_spec, content_pillars). Multi-account = many rows.
- `seed_targets` — accounts to watch per profile.
- `candidates` — surfaced reply **opportunities** (scored: relevance/velocity/recency). status: `surfaced → drafted → engaged → dismissed`.
- `drafts` — generated content (kind: `original` | `reply`, optional `candidate_id`). status: `draft → approved → posted → skipped`.
- `posts` — what actually went live + `metrics` (likes/views/replies), refreshed by tracking.
- `research_briefings` — daily research cache (one per profile per day).

**To multi-tenant (Stage 2):** add `user_id` ownership above `profiles`, RLS on
every table keyed to the authenticated user. The security workstream
(`harden/make-it-safe`) is already enabling RLS — that's the foundation.

---

## 5. Pipelines (where each runs)

| Pipeline | What | Engine | Stage 1 host | Stage 2 host |
|---|---|---|---|---|
| **Scan** | Apify pull → embed → score → upsert `candidates` | Apify + OpenAI embeddings (cloud-safe) | local or Vercel | Vercel cron |
| **Draft** | `candidates`/topics → reply & post drafts | `claude` (local) → API (cloud) | local | Vercel cron |
| **Pulse** | top opportunities → Telegram push w/ comment | reads DB + Telegram | local scheduler | Vercel cron |
| **Track** | refresh `posts.metrics` via Apify | Apify (cloud-safe) | local or Vercel | Vercel cron |

Scan & Track are already cloud-safe (no `claude`). Draft & Pulse are the parts
gated on the engine.

---

## 6. Pulse — the apex feature (Stage 1 build target)

"Ping me on my phone with a comment already written."

1. Scan targets → draft reply comments (local `claude`).
2. Push each top opportunity to Telegram: **author + tweet + link + ready-to-post comment.**
3. Inline buttons: **✅ Posted** (→ `candidates.engaged`, `drafts.posted`) / **⏭️ Skip** (→ `dismissed`) / **♻️ Regenerate**.
4. Scheduled on the Mac (launchd / `npm run pulse`).

Telegram is the phone app for v1 and carries into Stage 2 unchanged.

---

## 7. Productization path (Stage 2, when ready)

- **Engine:** `GEN_BACKEND=api` (Claude API). Quality matters for a growth product → prefer Claude over gemini; consider BYO-key to control cost.
- **Auth + tenancy:** user accounts, `user_id` ownership, RLS everywhere.
- **Always-on:** Vercel crons per user; hosted Telegram bot with per-user chat binding.
- **Billing:** subscription that covers token + Apify cost, or BYO-key tier.
- **Clients:** web app (primary) + Telegram (push). Native app only if pull demands it.

---

## 8. Open decisions (revisit at Stage 2)

- Claude API vs AI Gateway vs BYO-key for the product engine.
- Pricing model (flat subscription vs usage vs BYO-key).
- Whether Apify stays the scraper or X API returns at product scale.

---

## 9. Coordination note

Multiple agents currently share one working tree (branches: `make-it-solid`,
`harden/make-it-safe`, `make-it-true`). **Isolate each in its own `git worktree`**
to stop HEAD collisions. New workstreams (e.g. Pulse) should be their own branch.
