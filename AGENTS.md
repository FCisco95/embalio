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

<!-- linear-bridge:claude-md:start -->
## Linear workflow (Embalio, team BAK)

Tasks for this repo live in Linear. Follow this workflow without being asked. Use the `orca-linear` skill and the `orca linear` CLI for every Linear action.

- **Start:** if this worktree is linked to a Linear issue (`orca linear issue --current --full --json`), read it before planning. Its acceptance criteria are the definition of done.
- **Stay in scope:** do only what the issue asks, and don't fix unrelated things along the way.
- **Follow-ups:** when you find real out-of-scope work (a bug, a missing test, tech debt, or a TODO you're leaving behind), create it as a child issue of the current one, then add the label `agent-proposed`. Include what you found, where (file:line), and why it matters. Search for duplicates first. Create at most 3 per session, and never start working on one.
- **Finish:** follow the `orca-linear` completion flow. That means one summary comment covering what changed, what's left, and how to verify it, plus the PR link if there is one.
- **Ask first** before creating any other issue, or before changing priority, assignee, or estimate.
- **Never** close or cancel issues, or edit the Obsidian vault from this repo.
<!-- linear-bridge:claude-md:end -->
