<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Session handoffs

The canonical, living handoff for this repo is **`docs/HANDOFF.md`** — read it
first to learn current state, what's incomplete, and what to do next. It is
auto-loaded at session start by the `handoff-memory` plugin. Point-in-time
session snapshots are archived under `docs/handoffs/`. When wrapping up a
session, refresh `docs/HANDOFF.md` (and optionally drop a dated snapshot) rather
than writing handoffs to a temp dir.

# Repo tooling

Installed 2026-06-20 (registry: cisco-brain `40 - RESOURCES/Claude Code Tooling — Install Registry.md`):

- **LLM output (topic scorer, drafts, any model call)** → gate with the `promptfoo` skill (eval suites + red-team) before shipping changes that touch generation/scoring quality.
- **Landing / hero / CTA / marketing copy** → use the `great-web-copy` skill (PAS/AIDA/StoryBrand, bans buzzwords, `/audit-copy` scorer).
