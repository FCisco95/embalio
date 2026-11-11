<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Gate

`npm test`, `npx tsc --noEmit` and `npm run build` must pass before commit. CI uses Node 22. There are no git hooks.

## Stop and ask

Production SQL/migrations (owner-run), secrets and `.env*` (agents cannot edit), funds/signing, product decisions, deleting unique work. `main` auto-deploys to Vercel production.

## Invariants

- `docs/HANDOFF.md` is read at runtime (`src/lib/handoff-reader.ts`) and injected into LLM prompts. Keep the path and keep it short (target ~80 lines).
- The repo is public: no secrets, owner UUIDs or personal figures in docs. Write in "we".
- Where present, `docs/security/*.sql|json` are read by `scripts/check-*.mjs`. Do not move or rename them.

## Where docs go

- `docs/HANDOFF.md`: the only living handoff. Refresh it at session end.
- `docs/handoffs/`: a dated snapshot for a major event only.
- `docs/superpowers/plans/`: the active plan. An executed plan or audit is deleted once its outcome is in `HANDOFF.md` or `docs/GOAL-LOG.md`. Plans cited by code as decision records stay.
- `docs/security`, `docs/compliance`, `docs/runbooks`: live records.
- Screenshots, eval runs and generated output are never committed. Git history is the archive: `git show <tag>:<path>` (tag `pre-cleanup-2026-11` holds the pre-prune tree).

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
