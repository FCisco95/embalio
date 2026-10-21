# Embalio — Handoff (canonical)

## TL;DR

Production RLS recovery and `save_persona` hardening are owner-applied and verified
through SQL receipts and screenshots. Final Advisor: **0 errors, 1 warning,
2 suggestions**. Login/home works as `@fcisco95`, showing 20 drafts.
Session 26 tasks 1–3 are done. Task 4 awaits approval for one independent Linear
issue: the connected BAK inventory has no suitable parent. No issue was created.
Slice 2 still requires explicit owner confirmation of BOTH PR merge and X OAuth link.

## Metadata

- Project: embalio
- Branch: feat/revamp-slice0-contract
- Last Updated: 2026-10-21T21:16:12+01:00
- PR: https://github.com/FCisco95/embalio/pull/7 — OPEN, draft; remote head `3709ff3`.
- Local security/receipt commits: `a3a172b`, `2648b0b`, `ad9f0aa`, not pushed.
- Local and last-verified remote `main`: `f544ac4`. This is a later docs-only checkpoint.

## Current Objective

Wait for the pending independent-issue approval. The prior approval authorized a
child issue; “acho que sim, verific tu” authorized finding its parent, not creating
a new root. The full parent search is complete; do not ask the owner to find it again.
The prepared scope is `docs/proposals/2026-10-21-revamp-security-follow-up.md`.

## Current State

- Tasks 1–3: feature branch pushed and draft PR opened; real component checks at
  390 px passed; three clean merged harness worktrees/branches removed.
- Production: 19 tables have RLS, zero anonymous access, zero authenticated
  internal/admin privileges. All six profiles remain; three NULL owners are quarantined.
- Primary Auth ownership is verified. This is distinct from linking X OAuth,
  which remains unconfirmed. Five `20261021_*.sql` revamp migrations remain unapplied.
- BAK is reachable in Bakehouse Labs. Full inventory including archived found
  only onboarding BAK-1..4 and completed unrelated BAK-5; no projects or revamp parent.
  Existing labels `agent-proposed` and `Embalio` are available. No Linear write occurred.

## Recent Changes

Added guarded owner-run SQL, real disposable PostgreSQL 17 checks, and production
read-back receipts. `save_persona` pins an empty search path, qualifies relations
and `unnest`, preserves SECURITY INVOKER and the observed live behavior, and rejects
unknown source/contracts. No product source changed in this continuation.
No commands from the accidental MechanicOS paste were executed.

## Known Issues / Watch List

The remaining warning count fits the previously identified Pro-only breached-
password screening feature; normal bcrypt password storage works on Free. The final
screenshot selected Errors, so its remaining warning row was not expanded.
Info tables `algorithm_briefs` and `youtube_credentials` intentionally deny normal
API access and use service-role server code. No plan/Auth setting was changed.

Owner login/home and database metadata are verified. Dedicated queue/performance
routes, live writes, X publish, privileged RPC/view/trigger coverage and intrusion
history are not established by these checks. The proposed Server Action/URL/UI
follow-up is still unimplemented. Scope detail: `docs/security/2026-10-21-rls-recovery.md`.

## Next Actions

1. If explicit approval for the independent issue arrives, re-check duplicates
   and create exactly one BAK issue from the proposal, labelled `agent-proposed`
   and `Embalio`, with priority/assignee/estimate unset. Read back the result.
   Do not manufacture a parent or start its implementation.
2. Keep the completed RLS/function acceptance. Do not rerun production SQL to
   clear the paid-plan warning or intentional Info findings.
3. Await explicit PR-merge AND primary X-link confirmation before slice 2.
   Owner rollout order remains in the Session 26 task file and PR body.

## Resume Checklist

- Never merge or push `main`; do not edit `.env*`. Production SQL/migrations are owner-run.
- TDD for behavior changes; full suite, standalone tsc and build green before each commit.
- Original Claude session/pane/transcript remain read-only; never resume, alter or delete them.
- Verify git status, local/remote heads and PR status. Preserve unpushed work and other edits.
- Use `orca-linear` / `orca linear` for all Linear actions. Root-issue approval is still pending.

## Quick Reference

- Original queue: `docs/handoffs/2026-10-21-session26-codex-next-steps.md`.
- Security runbook and receipts: `docs/security/2026-10-21-rls-recovery.md`.
- Pending issue: `docs/proposals/2026-10-21-revamp-security-follow-up.md`.
- Browser receipt: `docs/reviews/2026-10-21-slice1-browser-check.md`.
- Full previous canonical/history: `docs/handoffs/20261021_211358-handoff-session27-security-closeout-history.md`.

## Validation

Latest full app suite: **1,242 passed / 1 skipped** (184 files passed / 1 skipped),
standalone `npx tsc --noEmit` and `npm run build` passed. SQL runners separately
verified RED→GREEN, owner isolation, atomic refusals, service access and idempotency.
An initial suite alongside a build hit one 5-second import timeout; focused and
sequential full reruns passed without source/timeout changes. All owned test containers removed.
Handoff metadata refresh/validation ran with installed Python 3.13; the default
Python 3.8 failed on `str.removesuffix` after creating the preserved snapshot.

## Suggested Skills

`task-observer`, `embalio`, `handoff-memory`, `orca-linear`;
`test-driven-development` for code; `verification-before-completion` before commits.

## Generated Artifacts

| Artifact | Home | State |
|---|---|---|
| Security SQL/runbook | `docs/security/2026-10-21-*.sql`, `2026-10-21-rls-recovery.md` | Owner-applied; retained for audit |
| RLS/function/Advisor receipts and live definition | `docs/security/2026-10-21-*.json` | Owner-supplied; no owner UUID stored |
| Disposable SQL checks | `scripts/check-rls-recovery.mjs`, `scripts/check-save-persona-hardening.mjs` | Tested; no production connection |
| Private prefilled bundle | `.superpowers/security-recovery/2026-10-21/apply-reviewed-rls.sql` | Git-ignored, contains private owner UUID; do not commit |

No keys, secrets, deployed resources or scheduled jobs were created by the agent.
The owner created their own Auth user. PR #7, the proposal and session snapshots are retained.

## Resume Prompt

```text
Resume Embalio from docs/HANDOFF.md. Read
docs/proposals/2026-10-21-revamp-security-follow-up.md and
docs/security/2026-10-21-rls-recovery.md. Verify git/PR state first.
RLS and save_persona are owner-applied; final Advisor is 0 errors / 1 warning / 2 suggestions.
Tasks 1–3 are done. BAK has no suitable parent; await approval for exactly one
independent agent-proposed + Embalio issue, then create/read back without implementing it.
Do not repeat the parent search or production SQL without a concrete new reason.
Model: GPT-6.1 Sol (high) — bounded repo/Linear continuation.
Skills: task-observer, embalio, handoff-memory, orca-linear, verification-before-completion.
Never merge/push main, edit .env*, or apply production migrations. Original Claude
session/transcript are read-only. Slice 2 requires explicit PR-merge AND X-link confirmation.
```
